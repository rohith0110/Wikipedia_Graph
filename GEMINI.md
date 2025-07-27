# Gemini Conversation Context

This file stores the context of the conversation with the Gemini CLI agent to allow for session restoration.

## Project Summary (2025-07-07)

The "WikiGraph Explorer" is a full-stack application designed to visualize the interconnectedness of Wikipedia articles.

### Core Components:

1.  **Python Backend (`Backend/`)**:
    *   A data pipeline that crawls Wikipedia (`create_graph_data.py`), ingests the data into a SQLite database (`ingest.py`), and generates a high-level overview graph (`create_overview.py`).
    *   A Flask API (`app.py`) serves the processed graph data to the frontend.

2.  **React Frontend (`wikigraph-explorer_React-APP/`)**:
    *   A web application that consumes the backend API.
    *   It uses the Sigma.js library (`WikiGraph.jsx`) to render interactive graphs of our data.
    *   Key features include a "Galaxy View" of topic clusters and a "Detail View" for individual articles and their immediate connections.

### Key Files:

*   `create_graph_data.py`: The main Wikipedia crawler.
*   `ingest.py`: Ingests crawler data into `wikipedia.db`.
*   `create_overview.py`: Creates `overview.json` for the initial frontend view.
*   `app.py`: The Flask API server.
*   `WikiGraph.jsx`: The core React component for graph rendering.
*   `ARCHITECTURE.md`: Detailed project architecture document.
*   `readme.md`: Main project README with setup instructions.
