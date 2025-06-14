# WikiGraph Explorer

WikiGraph Explorer is a full-stack web application that visualizes the interconnectedness of Wikipedia articles. It starts by crawling a set of seed topics on Wikipedia, builds a massive graph of articles and their links, and presents this data through an interactive, high-performance frontend.

Users can explore a "Galaxy View" showing topic clusters, search for specific articles, and drill down into a "Detail View" to see the immediate neighborhood of any article.

For a deep dive into the project's architecture, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Features

- **Robust Data Crawler**: A resilient Python script crawls Wikipedia, handling network errors, checkpointing progress, and sending email notifications on status and errors.
- **Efficient Data Pipeline**: Raw data is ingested into a performant SQLite database, which is then processed to generate optimized graph files for the frontend.
- **Galaxy Overview**: An initial view renders a pre-computed graph of the 750 most-linked articles, colored by topic clusters detected using the Louvain method.
- **Drill-Down Capability**: Search for any article in the database and instantly see a focused graph of its direct neighbors (incoming and outgoing links).
- **High-Performance Visualization**: Uses Sigma.js with custom, non-physics-based layout algorithms for a fast, clean, and deterministic rendering of complex graphs.
- **RESTful API**: A Flask backend serves the graph data, provides a fast search endpoint, and decouples the frontend from the data source.

---

## Tech Stack

- **Backend**:
  - **Language**: Python 3
  - **Web Framework**: Flask
  - **Crawling**: `wikipedia-api`, `requests`
  - **Data Processing**: `igraph`, `ijson`, `psutil`
  - **Database**: SQLite
  - **Notifications**: SendGrid
- **Frontend**:
  - **Framework**: React.js
  - **Graph Visualization**: Sigma.js, Graphology
  - **UI Components**: `react-select` for asynchronous search
  - **Styling**: CSS (Dark Theme)

---

## Project Structure

```
.
├── wikigraph-explorer/      # React Frontend Application
│   ├── public/
│   └── src/
│       ├── App.js           # Main app component, state management
│       ├── WikiGraph.jsx    # Sigma.js graph rendering component
│       ├── App.css          # Styles
│       └── ...
├── Backend/      # React Frontend Application
│   ├── create_graph_data.py     # Main Wikipedia crawler script
│   ├── ingest.py                # Ingests crawler output into SQLite
│   ├── create_overview.py       # Creates the main 'overview.json' graph
│   ├── app.py                   # Flask API server
│   ├── elements.json            # (Generated) Raw output from the crawler
│   ├── overview.json            # (Generated) Graph data for the main view
│   ├── wikipedia.db             # (Generated) SQLite database
│   ├── requirements.txt         # Python dependencies (You should create this)
│   └── ...
├── ARCHITECTURE.md
├── readme.md
├── LICENCE
└── ...
```

---

## Setup and Installation

You have two options to get started:

1.  **Use the Pre-computed Data (Recommended for Quick Start)**: Use the provided `wikipedia.db` and `overview.json` files to run the application immediately without crawling.
2.  **Generate Your Own Data**: Run the full data pipeline to crawl Wikipedia and build the database from scratch.

### Prerequisites

- Python 3.8+
- Node.js v16+ and npm

### Backend Setup

1.  **Clone the Repository**

    ```bash
    git clone https://github.com/rohith0110/Wikipedia_Graph.git
    cd Wikipedia_Graph
    cd Backend
    ```

2.  **Create a Python Virtual Environment**

    ```bash
    # For Windows
    python -m venv venv
    .\venv\Scripts\activate

    # For macOS/Linux
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install Python Dependencies**

    Create a `requirements.txt` file with the following content:

    ```txt
    # requirements.txt
    requests
    wikipedia-api
    tqdm
    sendgrid
    psutil
    ijson
    python-igraph
    flask
    flask-cors
    ```

    Then install them:

    ```bash
    pip install -r requirements.txt
    ```

### Frontend Setup

1.  **Navigate to the Frontend Directory**

    ```bash
    cd wikigraph-explorer_React-APP
    ```

2.  **Install Node.js Dependencies**

    ```bash
    npm install
    ```

3.  **Configure the API Endpoint**

    This is a **critical step**. You must tell the React app where your Flask backend is running.

    Open `wikigraph-explorer/src/App.js` and update the `API_URL`:

    ```javascript
    // For local development
    const API_URL = "http://127.0.0.1:5000";

    // If deploying, change this to your server's public IP or domain
    // const API_URL = "http://your-ec2-public-ip:5000";
    ```

---

## Running the Application

### Option 1: Using the Pre-computed Data

If you are using the `wikipedia.db` and `overview.json` files included in the repository, you can skip the data generation and run the server directly.

1.  **Start the Backend API Server**
    From the project's Backend directory:

    ```bash
    # Make sure your virtual environment is active
    python app.py
    ```

    The server will start on `http://0.0.0.0:5000`.

2.  **Start the Frontend Development Server**
    In a **new terminal**, navigate to the frontend directory:
    ```bash
    cd wikigraph-explorer
    npm start
    ```
    The React application will open in your browser, usually at `http://localhost:3000`.

### Option 2: Generating Your Own Data from Scratch

This process can take a significant amount of time and resources, especially the crawling step.

#### Step 1: Configure the Crawler

Open `create_graph_data.py` and review the configuration section.

- `SEED_TOPICS`: Change the initial topics to start crawling from.
- `CRAWL_DEPTH`: A depth of `2` is recommended. `3` will be massive.
- **Email Notifications (Optional but Recommended)**: To enable email heartbeats and error reports, sign up for a free [SendGrid](https://sendgrid.com/) account, create an API key, and update the following variables:
  ```python
  SENDGRID_API_KEY   = "YOUR_REAL_SENDGRID_API_KEY"
  EMAIL_FROM         = "your_verified_sender@example.com"
  EMAIL_TO           = "your_email@example.com"
  ```

#### Step 2: Run the Data Pipeline

Execute the scripts **in this specific order** from the project's root directory.

1.  **Run the Crawler**
    This will crawl Wikipedia and produce `elements.json` (and the log files `edges.jsonl` and `nodes.jsonl`). It will take a long time. The script can be stopped and resumed thanks to the checkpoint file.

    ```bash
    python create_graph_data.py
    ```

2.  **Ingest Data into SQLite**
    This script reads the massive `elements.json` and populates the `wikipedia.db` database.

    ```bash
    python ingest.py
    ```

3.  **Create the Overview Graph**
    This script queries the database, runs community detection on the top nodes, and creates `overview.json` for the frontend's initial view.
    ```bash
    python create_overview.py
    ```

#### Step 3: Run the Servers

Once the data generation is complete, follow the steps from **"Option 1: Using the Pre-computed Data"** to start the backend and frontend servers.

---

## Deployment Notes (EC2/Linux Server)

- **Persistent Sessions**: Use `tmux` or `screen` to run the crawler and the Flask app in persistent sessions, so they continue running after you disconnect your SSH client.
- **Firewall/Security Groups**: Ensure that the port used by the Flask app (e.g., port 5000) is open in your EC2 instance's security group to allow inbound traffic from your frontend.
- **Serving the Frontend**: For production, you should build the static React assets (`npm run build`) and serve them using a production-grade web server like Nginx or Apache, which can also act as a reverse proxy for your Flask API.

---

## License

This project is licensed under the MIT License. See the [`LICENCE`](./LICENCE) file for details.
