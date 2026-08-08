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
      // Decode Base64
      const content = decodeURIComponent(escape(atob(data.content)));
      return { content, sha: data.sha };
    } catch (e) {
      console.error(e);
      return { content: null, sha: null };
    }
  }

  async saveFile(path, contentStr, sha, message) {
    const encoded = btoa(unescape(encodeURIComponent(contentStr)));
    const body = {
      message: message,
      content: encoded,
    };
    if (sha) {
      body.sha = sha;
    }

    let response = await fetch(`${this.baseUrl}/contents/${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });

    // If there's a conflict (file exists but we didn't provide SHA, or SHA is outdated), 
    // fetch the latest SHA and retry once.
    if (response.status === 409 || response.status === 422) {
      const fileRes = await this.getFile(path);
      if (fileRes.sha) {
        body.sha = fileRes.sha;
        response = await fetch(`${this.baseUrl}/contents/${path}`, {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify(body)
        });
      }
    }

    if (!response.ok) {
      throw new Error(`Failed to save ${path}: ${response.statusText}`);
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
}
