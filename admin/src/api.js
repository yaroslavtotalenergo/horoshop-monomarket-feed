// GitHub API Client

export class GitHubApi {
  constructor(token, owner, repo) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  }

  getHeaders() {
    return {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      // 'If-None-Match': '' // Uncomment to bypass cache if needed
    };
  }

  async getFile(path) {
    try {
      const response = await fetch(`${this.baseUrl}/contents/${path}?timestamp=${new Date().getTime()}`, {
        headers: this.getHeaders()
      });
      if (!response.ok) {
        if (response.status === 404) return { content: null, sha: null };
        throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
      }
      const data = await response.json();
      
      let content = '';
      if (data.encoding === 'none' && data.git_url) {
        // File is too large (>1MB) for inline content, fetch via Git Database API
        const blobRes = await fetch(data.git_url, { headers: this.getHeaders() });
        const blobData = await blobRes.json();
        content = decodeURIComponent(escape(atob(blobData.content)));
      } else if (data.content) {
        // Decode Base64
        content = decodeURIComponent(escape(atob(data.content)));
      }
      
      return { content, sha: data.sha };
    } catch (e) {
      console.error(e);
      return { content: null, sha: null };
    }
  }

  async saveFile(path, contentStr, _sha, message) {
    // Always fetch the latest SHA from GitHub before saving to avoid stale SHA conflicts.
    const current = await this.getFile(path);
    const latestSha = current.sha;

    const encoded = btoa(unescape(encodeURIComponent(contentStr)));
    const body = { message, content: encoded };
    if (latestSha) body.sha = latestSha;

    const response = await fetch(`${this.baseUrl}/contents/${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Failed to save ${path}: ${response.status} ${response.statusText} — ${errBody}`);
    }

    return await response.json();
  }

  async triggerWorkflow(workflowId = 'update-feeds.yml', ref = 'main') {
    const response = await fetch(`${this.baseUrl}/actions/workflows/${workflowId}/dispatches`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ref })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to trigger workflow: ${response.statusText}`);
    }
  }

  async getWorkflowRuns(limit = 10) {
    try {
      const response = await fetch(`${this.baseUrl}/actions/runs?per_page=${limit}`, {
        headers: this.getHeaders()
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.workflow_runs || [];
    } catch (e) {
      console.error(e);
      return [];
    }
  }
}
