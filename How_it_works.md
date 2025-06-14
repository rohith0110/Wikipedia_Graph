## How It Works: The Data Pipeline & Application Logic

This project is divided into a data pipeline that prepares the graph information and a web application that serves and visualizes it. Here’s a detailed look at each component.

### 1. `create_graph_data.py` (The Crawler)

This is the heart of the data collection process. It's a robust, resilient script designed to crawl Wikipedia for extended periods without manual intervention.

#### **Core Logic**

- **BFS Traversal**: The script uses a Breadth-First Search (BFS) algorithm, starting from the `SEED_TOPICS`. It explores all articles at a certain depth before moving to the next level, up to the configured `CRAWL_DEPTH`.
- **Disk-Backed Storage**: To handle potentially millions of nodes and edges without running out of memory, the script does **not** store the graph in RAM. Instead, as it discovers nodes and edges, it immediately appends them to `nodes.jsonl` and `edges.jsonl` (JSON Lines format). This makes the process memory-efficient and scalable.
- **Resilience and Checkpointing**:
  - If the script is stopped or crashes, it can be restarted and will automatically resume from where it left off by loading the `crawler_checkpoint.json` file.
  - It includes logic to retry failed network requests and a polite delay between requests to avoid overwhelming Wikipedia's servers.
- **Notifications**: It can send email notifications via SendGrid for:
  - **Heartbeats**: A periodic "I'm still alive" message.
  - **Success/Failure**: An email upon successful completion or a crash with a full traceback for debugging.
- **Final Output**: Once the crawl is complete, it aggregates all the data from memory (`in_degree`, etc.) and the log files to generate a single, large `elements.json` file in a format suitable for Cytoscape.js or further processing.

#### **Configuration (`create_graph_data.py`)**

You can customize the crawl by modifying these constants at the top of the file:

- `SEED_TOPICS`: An array of strings representing the starting Wikipedia article titles. This is the most important setting to define the scope of your graph.
  ```python
  # Example: Focus on ancient civilizations
  SEED_TOPICS = ["Roman Empire", "Ancient Greece", "Ancient Egypt", "Persian Empire"]
  ```
- `CRAWL_DEPTH`: An integer that controls how many "clicks" away from the seed topics the crawler will go. **Be careful:** This number grows exponentially.
  - `1`: Seed topics and the articles they link to.
  - `2`: (Recommended Default) Goes one level deeper. Generates a rich, but manageable dataset.
  - `3`: Will result in a _massive_ dataset that could take days to crawl and hundreds of gigabytes of disk space.
- **Email / SendGrid Settings**: To enable email notifications, update these with your SendGrid credentials.
  - `SENDGRID_API_KEY`: Your API key from SendGrid.
  - `EMAIL_FROM`: A verified sender identity in your SendGrid account.
  - `EMAIL_TO`: The recipient's email address.

---

### 2. `ingest.py` (The Ingester)

This script's sole purpose is to take the massive, flat `elements.json` file and load it into a structured, indexed SQLite database (`wikipedia.db`).

#### **Core Logic**

- **Streaming Parser**: It uses the `ijson` library to stream-parse the JSON file. This is crucial because `elements.json` can be several gigabytes in size—too large to load into memory at once.
- **Database Population**: It creates `nodes` and `edges` tables in the SQLite database if they don't exist.
- **Bulk Inserts**: It processes the streamed data in batches and uses `executemany` for efficient bulk insertion into the database, which is much faster than inserting one row at a time.
- **Indexing**: After inserting all the data, it creates indexes on the tables' key columns (`source`, `target`, `label`). This makes future lookups by the API server extremely fast.

#### **Configuration (`ingest.py`)**

This script is generally not configured. It's designed to work with the default file names (`elements.json` and `wikipedia.db`) produced and expected by the other scripts.

---

### 3. `create_overview.py` (The Overview Generator)

This script is responsible for creating the `overview.json` file, which powers the initial "Galaxy View" on the frontend. It creates a smaller, more manageable summary of the entire dataset.

#### **Core Logic**

- **Top-N Selection**: It queries the database to get the `TOP_N_NODES` with the highest "size" (which correlates to in-degree/popularity from the crawl). This focuses the overview on the most important articles.
- **Graph Construction**: It builds an in-memory graph using the `python-igraph` library, containing only these top nodes and the edges that connect them.
- **Community Detection**: It runs the Louvain community detection algorithm (`community_multilevel`) on the graph. This algorithm is excellent at finding dense clusters of nodes (i.e., "topic clusters").
- **Final Output**: It generates `overview.json`, where each node is annotated with a `cluster_id` based on the community detection results. This ID is used by the frontend to color the nodes, creating the "galaxy" clusters.

#### **Configuration (`create_overview.py`)**

- `TOP_N_NODES`: The number of top nodes to include in the overview graph. A larger number will create a denser and more complex overview, but will also increase the initial load time on the frontend. `750` is a good balance.

---

### 4. `app.py` (The API Server)

This is the Flask web server that acts as the bridge between your database and the frontend.

#### **Endpoints**

- `GET /api/overview-graph`:

  - **Purpose**: Serves the pre-computed `overview.json` file.
  - **Response**: A static JSON file containing the nodes and edges for the main "Galaxy View".

- `GET /api/search?q=<query>`:

  - **Purpose**: Provides a fast, live search for the autocomplete box in the UI.
  - **Logic**: It performs a `LIKE` query against the `nodes` table. The results are ranked to prioritize exact matches and prefix matches over general substring matches, providing a better user experience.

- `GET /api/graph/<node_id>`:
  - **Purpose**: Fetches the data needed for the "Detail View" when a user selects a node.
  - **Logic**: Given a `node_id`, it queries the database for that node and all of its 1st-degree neighbors (both articles it links to and articles that link to it). It then gathers all the edges connecting this subgraph of nodes.
  - **Response**: A JSON array of node and edge objects for the frontend to render.

---

### 5. `WikiGraph.jsx` (The Frontend Renderer)

This React component is the most complex part of the frontend, responsible for all graph rendering using Sigma.js.

#### **Core Logic**

- **No Physics Simulation**: A key design choice is the **rejection of force-directed physics layouts**. Instead, it uses deterministic, pre-calculated layouts for speed and predictability. This prevents nodes from constantly shifting and provides an instantaneous, stable view.
- **Two Layout Modes**:
  1.  **Overview (`createDenseClusters`)**: For the "Galaxy View", it implements a custom algorithm. It first places the center of each detected cluster in a large circle, then places the nodes within each cluster using a combination of random placement and collision detection to create dense but non-overlapping "topic galaxies".
  2.  **Detail (`createDetailLayout`)**: For the "Detail View", it places the selected node at `(0, 0)` and arranges its neighbors in a circular area around it, again using collision detection to ensure a clean, readable layout.
- **Interactivity**: It uses Sigma.js event listeners to handle user interactions:
  - `onEnterNode`: Highlights the hovered node and its immediate neighbors, fading out the rest of the graph.
  - `onLeaveNode`: Resets the graph to its normal state.
  - `onClickNode`: Opens the corresponding Wikipedia article in a new tab.
