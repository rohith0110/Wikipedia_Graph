#!/usr/bin/env python3
# create_graph_data.py (v4 – Disk‐backed + Checkpoint + Email + Heartbeat)

import os
import time
import json
import threading
import traceback
import base64
import psutil
from collections import deque

import requests
import wikipediaapi
from tqdm import tqdm

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import (
    Mail, Attachment, FileContent, FileName, FileType, Disposition
)

# --- CONFIGURATION ---
SEED_TOPICS        = ["Science", "History", "Technology", "Art", "Philosophy", "Mathematics", "Geography"]
CRAWL_DEPTH        = 2
OUTPUT_FILE        = "elements.json"
EDGE_LOG_FILE      = "edges.jsonl"
NODE_LOG_FILE      = "nodes.jsonl"
CHECKPOINT_FILE    = "crawler_checkpoint.json"

# --- RESILIENCE SETTINGS ---
REQUEST_TIMEOUT    = 60       # seconds
RETRY_ATTEMPTS     = 10
RETRY_DELAY        = 10       # seconds
POLITE_DELAY       = 1.00     # seconds between requests
CHECKPOINT_EVERY   = 50       # pages processed before checkpointing

# --- EMAIL / SENDGRID SETTINGS ---
SENDGRID_API_KEY   = "YOURSGAPIKEY"
EMAIL_FROM         = "rohithcoding1221@gmail.com"
EMAIL_TO           = "banothrohithrathod@gmail.com"
HEARTBEAT_INTERVAL = 600      # seconds

def send_email(subject, plain_text, attachment_path=None):
    """Send an email (with optional attachment) via SendGrid."""
    message = Mail(
        from_email=EMAIL_FROM,
        to_emails=EMAIL_TO,
        subject=subject,
        plain_text_content=plain_text
    )
    if attachment_path:
        with open(attachment_path, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        message.attachment = Attachment(
            FileContent(data),
            FileName(os.path.basename(attachment_path)),
            FileType("application/json"),
            Disposition("attachment")
        )
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        sg.send(message)
        print(f"[Email sent] {subject}")
    except Exception as e:
        err_body = getattr(e, 'body', None)
        print(f"[Email error] {type(e).__name__}: {e}")
        if err_body:
            print("SendGrid response body:", err_body)

def heartbeat():
    """Send a periodic “still running” email, then re-schedule."""
    send_email(
        subject="Crawler Heartbeat: still running",
        plain_text="Your Wikipedia crawler is still running without errors."
    )
    threading.Timer(HEARTBEAT_INTERVAL, heartbeat).start()

def log_memory_usage():
    proc = psutil.Process(os.getpid())
    rss = proc.memory_info().rss / 1024**2
    print(f"[Memory] RSS = {rss:.1f} MB")

def load_checkpoint():
    if not os.path.exists(CHECKPOINT_FILE):
        return None
    with open(CHECKPOINT_FILE) as f:
        data = json.load(f)
    return data

def save_checkpoint(queue, visited):
    data = {
        "queue": list(queue),
        "visited": list(visited)
    }
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(data, f)

if __name__ == "__main__":
    try:
        heartbeat()  # start heartbeats

        # Load or initialize queue & visited
        cp = load_checkpoint()
        if cp:
            queue = deque((t, d) for t, d in cp["queue"])
            visited_in_queue = set(cp["visited"])
            print(f"[Checkpoint] Loaded {len(queue)} items in queue.")
        else:
            queue = deque((topic, 0) for topic in SEED_TOPICS)
            visited_in_queue = set(SEED_TOPICS)

        # Always reinitialize nodes & in_degree afresh
        nodes = set()
        in_degree = {}

        # Open disk logs
        edge_file = open(EDGE_LOG_FILE, "a")
        node_file = open(NODE_LOG_FILE, "a")

        wiki_api = wikipediaapi.Wikipedia(
            language="en",
            user_agent="WikiGraphExplorer/1.0",
            timeout=REQUEST_TIMEOUT
        )

        pbar = tqdm(total=len(queue), desc="Crawling Wikipedia")
        processed = 0

        while queue:
            title, depth = queue.popleft()
            pbar.set_postfix({"Current": title[:20], "Depth": depth, "Queue": len(queue)})
            processed += 1

            # Memory log every so often
            if processed % 50 == 0:
                log_memory_usage()

            # Fetch page with retry logic
            page = None
            for attempt in range(RETRY_ATTEMPTS):
                try:
                    page = wiki_api.page(title)
                    if not page.exists():
                        page = None
                    break
                except (requests.exceptions.ConnectionError, requests.exceptions.ReadTimeout):
                    time.sleep(RETRY_DELAY)
            if page is None or depth >= CRAWL_DEPTH:
                pbar.update(1)
                continue

            # Register node if new
            if title not in nodes:
                nodes.add(title)
                in_degree[title] = in_degree.get(title, 0)
                node_file.write(json.dumps({"id": title}) + "\n")

            # Process links
            for link in page.links.values():
                lt = link.title
                if ":" in lt:
                    continue
                # Node logging
                if lt not in nodes:
                    nodes.add(lt)
                    in_degree[lt] = 0
                    node_file.write(json.dumps({"id": lt}) + "\n")

                # Edge logging
                edge = {"from": title, "to": lt}
                edge_file.write(json.dumps(edge) + "\n")
                in_degree[lt] = in_degree.get(lt, 0) + 1

                # Enqueue
                if depth + 1 < CRAWL_DEPTH and lt not in visited_in_queue:
                    visited_in_queue.add(lt)
                    queue.append((lt, depth + 1))
                    pbar.total += 1

            pbar.update(1)
            time.sleep(POLITE_DELAY)

            # Periodic checkpoint
            if processed % CHECKPOINT_EVERY == 0:
                save_checkpoint(queue, visited_in_queue)
                print(f"[Checkpoint] Saved queue of size {len(queue)}")

        pbar.close()
        edge_file.close()
        node_file.close()

        # Build final Cytoscape elements file
        print(f"\nCrawling complete. Formatting output…")
        cytoscape_elements = []
        BASE_NODE_SIZE = 10
        MAX_NODE_SIZE = 150
        max_in = max(in_degree.values()) if in_degree else 1

        # Nodes
        for node_id in tqdm(nodes, desc="Formatting Nodes"):
            deg = in_degree.get(node_id, 0)
            size = BASE_NODE_SIZE + (MAX_NODE_SIZE - BASE_NODE_SIZE) * (deg / max_in)
            cytoscape_elements.append({
                "data": {"id": node_id, "label": node_id.replace("_"," "), "size": size, "url": f"https://en.wikipedia.org/wiki/{node_id}"}
            })
        # Edges
        with open(EDGE_LOG_FILE) as ef:
            for line in tqdm(ef, desc="Formatting Edges"):
                src_tgt = json.loads(line)
                cytoscape_elements.append({
                    "data": {
                        "source": src_tgt["from"],
                        "target": src_tgt["to"],
                        "label": f"{src_tgt['from']} → {src_tgt['to']}"
                    }
                })

        # Save final JSON
        with open(OUTPUT_FILE, "w") as outf:
            json.dump(cytoscape_elements, outf)
        print(f"Saved {len(cytoscape_elements)} elements to {OUTPUT_FILE}.")

        # Final email
        send_email(
            subject="Crawler Finished Successfully",
            plain_text=f"Crawl complete: {len(nodes)} nodes, {sum(in_degree.values())} edges.",
            attachment_path=OUTPUT_FILE
        )

    except Exception:
        tb = traceback.format_exc()
        send_email(
            subject="Crawler ERROR!",
            plain_text=f"The crawler crashed with the following traceback:\n\n{tb}"
        )
        raise
