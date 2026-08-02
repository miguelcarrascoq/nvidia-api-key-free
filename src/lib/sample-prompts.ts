export const SAMPLE_PROMPTS: readonly string[] = [
  // Code (~18)
  'Write a Go function that runs up to N worker goroutines from a job channel and waits for all of them to finish with sync.WaitGroup.',
  'In Python, explain the difference between a list, a tuple, and a set, then show a short example of when you would use each.',
  'Write a JavaScript function that debounces another function by a given delay in milliseconds.',
  'Show a TypeScript type-safe fetch helper that returns a Result<{data}, {error}> style object instead of throwing.',
  'Write a PHP function that validates an email and returns a structured error message if invalid.',
  'Write a SQL query that returns the top 5 customers by total order amount in the last 30 days, including customers with zero orders.',
  'In Rust, explain ownership briefly and show a small example where the borrow checker would reject a compile error, then the fixed version.',
  'Write a Java method that reverses a linked list iteratively and state its time and space complexity.',
  'Explain how async/await works in JavaScript compared to raw Promises, with a short concurrent example using Promise.all.',
  'Write a Python context manager that times a code block and prints elapsed milliseconds when the block exits.',
  'In Go, show how to implement a simple in-memory rate limiter (token bucket) for an HTTP handler.',
  'Write a recursive and an iterative solution in JavaScript to compute Fibonacci(n), and say which you would use in production and why.',
  'Explain PHP references vs values for arrays and objects, with a short code sample that surprises beginners.',
  'Write a SQL migration-friendly query to find duplicate emails in a users table and keep only the oldest row id.',
  'In Python, show how to use pathlib to walk a directory tree and collect all .json file paths.',
  'Write a Go HTTP middleware that adds a request ID header and logs method, path, status, and duration.',
  'Explain closures in JavaScript with a classic for-loop + setTimeout gotcha and the modern fix.',
  'Write a short TypeScript interface and Zod-like validation sketch for a user signup payload (email, password, age).',

  // Mermaid / process (~10)
  'Draw a Mermaid flowchart for a user login flow including MFA, and briefly explain each decision node.',
  'Create a Mermaid sequence diagram for a browser calling an API gateway that then talks to auth and a database.',
  'Draw a Mermaid state diagram for an order lifecycle: draft, paid, shipped, delivered, cancelled, refunded.',
  'Create a Mermaid flowchart for a CI/CD pipeline: lint, test, build, staging deploy, approval, production deploy.',
  'Draw a Mermaid sequence diagram for OAuth 2.0 authorization code flow with PKCE.',
  'Create a Mermaid flowchart for incident triage: detect, acknowledge, mitigate, resolve, postmortem.',
  'Draw a Mermaid ER-style diagram (using flowchart or erDiagram) for users, roles, and permissions with many-to-many relationships.',
  'Create a Mermaid sequence diagram for a blue/green deployment with health checks and traffic switch.',
  'Draw a Mermaid flowchart for password reset: request, email token, validate, update password, invalidate sessions.',
  'Create a Mermaid state diagram for a WebSocket connection: connecting, open, reconnecting, closed, failed.',

  // OS commands (~12)
  'What Linux command finds the process listening on TCP port 8080, and how do you kill it safely?',
  'On macOS, how do you list open files for a process and free a stuck port used by a Node server?',
  'On Windows, what PowerShell commands show which process owns port 443 and stop that process?',
  'Give the Linux commands to recursively change ownership and permissions on a project directory for a deploy user.',
  'How do you check disk usage by directory on Linux and find the largest folders under /var?',
  'On macOS, what command shows DNS resolvers in use and how do you flush the DNS cache?',
  'On Windows, how do you list and restart a Windows service from PowerShell, with an example for a named service?',
  'What Linux command traces system calls of a running process, and when would you use it for debugging?',
  'How do you create a compressed tar archive of a folder on Linux, then extract it elsewhere?',
  'On macOS or Linux, how do you follow a log file in real time and filter for ERROR lines with grep?',
  'On Windows CMD or PowerShell, how do you recursively search file contents for a string under a folder?',
  'What Linux commands show network interfaces, routing table, and whether you can reach a host on port 22?',

  // Dev tooling / infra (~10)
  'Explain the difference between git merge and git rebase, and when you should avoid rebasing a shared branch.',
  'Write a minimal Dockerfile for a Node.js Express app that uses a multi-stage build and a non-root user.',
  'How do you inspect Docker container logs, exec into a running container, and copy a file out of it?',
  'Write a bash script that retries a curl request up to 5 times with exponential backoff and exits non-zero on failure.',
  'Explain HTTP status codes 401, 403, and 429 with a practical API example for each.',
  'How do you find which commit introduced a bug using git bisect? Outline the commands step by step.',
  'Write a docker-compose.yml sketch with a web app, PostgreSQL, and a volume for persistent data.',
  'Explain the difference between TCP and UDP, and when you would choose each for an application protocol.',
  'How do you debug a slow API endpoint: list concrete steps using logs, metrics, and one profiling idea.',
  'Write a GitHub Actions workflow sketch that runs tests on pull requests and builds a Docker image on main.',
];

export function createShuffledPromptDeck(prompts: readonly string[]): string[] {
  const deck = [...prompts];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  return deck;
}

export function nextSamplePrompt(
  deck: string[],
  prompts: readonly string[],
): { prompt: string; deck: string[] } {
  let nextDeck = deck;
  if (nextDeck.length === 0) {
    nextDeck = createShuffledPromptDeck(prompts);
  }
  const prompt = nextDeck[nextDeck.length - 1]!;
  return {
    prompt,
    deck: nextDeck.slice(0, -1),
  };
}
