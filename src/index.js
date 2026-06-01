// XML Entity Unescaper helper
function unescapeXml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Convert a flat list of URLs into a parent-child hierarchical tree structure
function buildTreeFromUrls(urls) {
  if (urls.length === 0) return [];
  
  const rootNodesMap = {};
  let nodeCounter = 0;
  
  for (const urlStr of urls) {
    try {
      const url = new URL(urlStr);
      const host = url.host;
      
      // Split pathname and remove empty parts
      const pathParts = url.pathname.split('/').filter(p => p.length > 0);
      
      // Create root node for this host if it doesn't exist
      if (!rootNodesMap[host]) {
        rootNodesMap[host] = {
          id: `node_${++nodeCounter}`,
          name: host,
          children: [],
          type: 'folder',
          path: host,
          url: `${url.protocol}//${host}`,
          depth: 0
        };
      }
      
      let current = rootNodesMap[host];
      let currentPath = host;
      
      // Build hierarchy for each folder/file part of the URL path
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        currentPath = `${currentPath} > ${part}`;
        
        let child = current.children.find(c => c.name === part);
        if (!child) {
          child = {
            id: `node_${++nodeCounter}`,
            name: part,
            children: [],
            type: 'file', // Default to file, will update to folder if it gets children
            path: currentPath,
            url: `${url.protocol}//${currentPath.split(' > ').join('/')}${url.search}`,
            depth: i + 1
          };
          current.children.push(child);
          current.type = 'folder'; // Parent has a child, so it's a folder
        }
        current = child;
      }
    } catch (err) {
      // Ignore malformed URLs
    }
  }
  
  return Object.values(rootNodesMap);
}

// Recursive Tree Sorting (folders on top, files on bottom, both alphabetically)
function sortTree(nodes) {
  nodes.sort((a, b) => {
    const aIsFolder = a.type === 'folder';
    const bIsFolder = b.type === 'folder';
    
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  });
  
  nodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      sortTree(node.children);
    }
  });
}

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env, ctx) {
    // Handle OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);

    // API Endpoint to fetch and parse sitemap
    if (url.pathname === '/api/parse') {
      const sitemapUrl = url.searchParams.get('url');

      if (!sitemapUrl) {
        return new Response(
          JSON.stringify({ error: 'Sitemap URL is required.' }),
          { status: 400, headers: jsonHeaders }
        );
      }

      // Validate URL format
      try {
        new URL(sitemapUrl);
      } catch (err) {
        return new Response(
          JSON.stringify({ error: 'Invalid URL format. Make sure to include http:// or https://' }),
          { status: 400, headers: jsonHeaders }
        );
      }

      let response;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        console.log(`[Parser] Fetching sitemap from: ${sitemapUrl}`);
        
        response = await fetch(sitemapUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/xml, text/xml, application/xhtml+xml, */*'
          }
        });
      } catch (err) {
        console.error(`[Parser] Fetch error:`, err);
        if (err.name === 'AbortError') {
          return new Response(
            JSON.stringify({ error: 'Connection timed out while fetching the sitemap. The host took too long to respond.' }),
            { status: 504, headers: jsonHeaders }
          );
        }
        return new Response(
          JSON.stringify({ error: 'Failed to fetch the sitemap. The server might be down, blocking requests, or network settings might prevent connection.' }),
          { status: 502, headers: jsonHeaders }
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Sitemap server returned HTTP error code ${response.status}: ${response.statusText || response.status}` }),
          { status: response.status, headers: jsonHeaders }
        );
      }

      const xmlText = await response.text();

      if (!xmlText || !xmlText.trim()) {
        return new Response(
          JSON.stringify({ error: 'Empty or invalid sitemap content received.' }),
          { status: 422, headers: jsonHeaders }
        );
      }

      // Simple and robust XML locator matching for <loc>...</loc> tags
      const locRegex = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
      let match;
      const urls = [];

      while ((match = locRegex.exec(xmlText)) !== null) {
        urls.push(unescapeXml(match[1].trim()));
      }

      console.log(`[Parser] Found ${urls.length} URLs in sitemap.`);

      if (urls.length === 0) {
        return new Response(
          JSON.stringify({
            error: 'No URLs found in the sitemap. Please verify that this is a valid XML sitemap containing `<loc>` tags.'
          }),
          { status: 422, headers: jsonHeaders }
        );
      }

      // Build tree
      const tree = buildTreeFromUrls(urls);

      // Sort tree
      sortTree(tree);

      // Calculate stats
      let total = 0;
      let folders = 0;
      let files = 0;
      let maxDepth = 0;

      function traverse(node) {
        total++;
        maxDepth = Math.max(maxDepth, node.depth);
        if (node.type === 'folder') {
          folders++;
          node.children.forEach(traverse);
        } else {
          files++;
        }
      }
      tree.forEach(traverse);

      return new Response(
        JSON.stringify({
          treeData: tree,
          stats: {
            totalCount: total,
            folderCount: folders,
            fileCount: files,
            maxDepth: maxDepth
          }
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // Default 404 for non-existent API routes
    // (Static assets are served automatically before reaching here)
    return new Response(
      JSON.stringify({ error: 'Not Found' }),
      { status: 404, headers: jsonHeaders }
    );
  },
};
