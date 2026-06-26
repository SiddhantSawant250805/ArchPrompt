import { NextRequest, NextResponse } from "next/server";

/**
 * GitHub Push API Endpoint
 * Pushes diagram files (SVG, Draw.io XML, Mermaid code) to a GitHub repository
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      owner,
      repo,
      branch,
      path,
      message,
      content,
      committerName,
      committerEmail,
    } = body;

    // Validate required fields
    if (!owner || !repo || !path || !content) {
      return NextResponse.json(
        { error: "Missing required fields: owner, repo, path, and content are required." },
        { status: 400 }
      );
    }

    // Check for GitHub token
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN environment variable not configured. Please add a GitHub Personal Access Token with repo permissions." },
        { status: 500 }
      );
    }

    const apiBase = "https://api.github.com";
    const filePath = path.startsWith("/") ? path : `/${path}`;
    const url = `${apiBase}/repos/${owner}/${repo}/contents${filePath}?ref=${branch || "main"}`;

    // Get current file SHA if it exists (for updates)
    let sha: string | null = null;
    try {
      const existingFileRes = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "ArchPrompt-Diagram-Exporter",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      if (existingFileRes.ok) {
        const existingData = await existingFileRes.json();
        sha = existingData.sha;
      }
    } catch {
      // File doesn't exist, will create new
    }

    // Prepare the commit payload
    const commitPayload = {
      message: message || `Update diagram: ${path}`,
      content: Buffer.from(content).toString("base64"),
      branch: branch || "main",
      committer: {
        name: committerName || "ArchPrompt Bot",
        email: committerEmail || "archprompt-bot@example.com",
      },
      ...(sha && { sha }), // Include SHA for updates
    };

    // Create or update file
    const createRes = await fetch(`${apiBase}/repos/${owner}/${repo}/contents${filePath}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "ArchPrompt-Diagram-Exporter",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(commitPayload),
    });

    if (!createRes.ok) {
      const errorData = await createRes.json().catch(() => ({}));
      console.error("GitHub API Error:", errorData);
      return NextResponse.json(
        {
          error: `GitHub API error: ${errorData.message || createRes.statusText}`,
          details: errorData,
        },
        { status: createRes.status }
      );
    }

    const result = await createRes.json();

    return NextResponse.json({
      success: true,
      url: result.content?.html_url || result.commit?.html_url,
      commitSha: result.commit?.sha,
      message: sha ? "File updated successfully" : "File created successfully",
    });
  } catch (error: any) {
    console.error("GitHub push error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during GitHub push." },
      { status: 500 }
    );
  }
}
