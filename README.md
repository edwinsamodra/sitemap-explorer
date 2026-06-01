# Sitemap Explorer

A beautiful, full-stack, and interactive XML sitemap visualizer. Built with a Node.js Express backend and a responsive Tailwind CSS frontend, it parses sitemaps into an elegant accordion tree structure with alphabetical folders-first sorting.

## Features

- **CORS Bypass Proxy**: Fetches sitemaps securely from the backend to bypass browser CORS restrictions.
- **Interactive Accordion Tree**: Nested parent-child directories toggle cleanly with smooth collapsible animations.
- **Folders-First Alphabetical Sorting**: Folders are automatically grouped at the top and files/leaves at the bottom, sorted alphabetically.
- **Search & Highlighting**: Quick search queries highlight matched letters and automatically expand parent directories to show matches.
- **Node Inspector**: Click on any folder or file to copy its full path or open the URL in a new tab.
- **Dynamic Stats Dashboard**: Real-time stats counting total nodes, folders, files, and maximum depth.
- **Clean Aesthetic & Dark Mode**: A premium, modern interface with curated HSL color schemes and local storage theme persistence.

## Tech Stack

- **Backend**: Node.js, Express, Axios, CORS
- **Frontend**: HTML5, Tailwind CSS, Lucide Icons

## Getting Started

### Prerequisites

Make sure you have [Node.js](https://nodejs.org) installed.

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   cd sitemap-explorer
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

### Running the App

Start the backend server:
```bash
npm run dev
```

The application will be running at **[http://localhost:8787](http://localhost:8787)**.
