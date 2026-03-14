/**
 * Sync CSV backup to GitHub using the Contents API
 */

export async function syncToGitHub(repo, token, csvContent) {
  const [owner, repoName] = repo.split('/').filter(Boolean);
  if (!owner || !repoName) {
    throw new Error('Invalid repo format. Use: owner/repo (e.g. username/relocation)');
  }

  const path = 'backup/relocation-tasks.csv';
  const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;

  const contentBase64 = btoa(unescape(encodeURIComponent(csvContent)));

  // Check if file exists
  let sha = null;
  try {
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch (e) {
    // File may not exist yet
  }

  const body = {
    message: `Backup: ${new Date().toISOString()}`,
    content: contentBase64,
    ...(sha && { sha }),
  };

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }

  return true;
}

export async function fetchFromGitHub(repo, token) {
  const [owner, repoName] = repo.split('/').filter(Boolean);
  if (!owner || !repoName) {
    throw new Error('Invalid repo format. Use: owner/repo');
  }

  const path = 'backup/relocation-tasks.csv';
  const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }

  const data = await res.json();
  const content = atob(data.content.replace(/\n/g, ''));
  return decodeURIComponent(escape(content));
}
