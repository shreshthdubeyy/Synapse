/**
 * Jira Epic Hierarchy Analyzer - Mock Data & Parser
 */

window.GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXR9LB1RgpkITXJv7HqAMcE3IuYKF1BzWWbEZJc0ZaUzvUI0OjWrxGUNqnkuRH6A5t3A/exec";


// Helper to convert Atlassian Document Format (ADF) to Markdown/Plain Text
function adfToMarkdown(doc) {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  if (!doc.content) return '';

  let text = '';
  function traverse(node) {
    if (!node) return;
    if (node.type === 'text') {
      let nodeText = node.text || '';
      if (node.marks) {
        node.marks.forEach(mark => {
          if (mark.type === 'strong') nodeText = `**${nodeText}**`;
          if (mark.type === 'em') nodeText = `*${nodeText}*`;
          if (mark.type === 'strike') nodeText = `~~${nodeText}~~`;
          if (mark.type === 'code') nodeText = `\`${nodeText}\``;
        });
      }
      text += nodeText;
    } else if (node.type === 'paragraph') {
      if (node.content) {
        node.content.forEach(traverse);
      }
      text += '\n\n';
    } else if (node.type === 'heading') {
      const level = node.attrs ? node.attrs.level : 1;
      text += '\n' + '#'.repeat(level) + ' ';
      if (node.content) {
        node.content.forEach(traverse);
      }
      text += '\n\n';
    } else if (node.type === 'bulletList') {
      if (node.content) {
        node.content.forEach(item => {
          text += '- ';
          if (item.content) item.content.forEach(traverse);
          text += '\n';
        });
      }
      text += '\n';
    } else if (node.type === 'orderedList') {
      if (node.content) {
        let index = 1;
        node.content.forEach(item => {
          text += `${index}. `;
          if (item.content) item.content.forEach(traverse);
          text += '\n';
          index++;
        });
      }
      text += '\n';
    } else if (node.type === 'listItem') {
      if (node.content) {
        node.content.forEach(traverse);
      }
    } else if (node.type === 'table') {
      if (node.content && node.content.length > 0) {
        let isFirstRow = true;
        node.content.forEach(row => {
          if (row.type === 'tableRow' && row.content) {
            let rowText = '|';
            let dividerText = '|';
            row.content.forEach(cell => {
              if (cell.type === 'tableHeader' || cell.type === 'tableCell') {
                let cellContentText = '';
                if (cell.content) {
                  const savedText = text;
                  text = '';
                  cell.content.forEach(traverse);
                  cellContentText = text.trim().replace(/\n+/g, ' ');
                  text = savedText;
                }
                rowText += ` ${cellContentText} |`;
                dividerText += ' --- |';
              }
            });
            text += '\n' + rowText;
            if (isFirstRow) {
              text += '\n' + dividerText;
              isFirstRow = false;
            }
          }
        });
        text += '\n\n';
      }
    } else if (node.content) {
      node.content.forEach(traverse);
    }
  }

  doc.content.forEach(traverse);
  return text.trim();
}

// --- RICH ASSETS HELPERS ---
function getIssueIconUrl(type, customUrl) {
  if (customUrl) return customUrl;
  const typeLower = type ? type.toLowerCase() : 'task';
  const defaultIcons = {
    epic: 'https://raw.githubusercontent.com/ricky-graham/jira-navigator/master/src/assets/epic.svg',
    story: 'https://raw.githubusercontent.com/ricky-graham/jira-navigator/master/src/assets/story.svg',
    bug: 'https://raw.githubusercontent.com/ricky-graham/jira-navigator/master/src/assets/bug.svg',
    task: 'https://raw.githubusercontent.com/ricky-graham/jira-navigator/master/src/assets/task.svg',
    subtask: 'https://raw.githubusercontent.com/ricky-graham/jira-navigator/master/src/assets/subtask.svg'
  };
  return defaultIcons[typeLower] || defaultIcons.task;
}

function getUserAvatarUrl(name, customUrl) {
  if (customUrl) return customUrl;
  const colors = {
    'Sarah Connor': '8b5cf6',
    'John Doe': '6366f1',
    'Ada Lovelace': '06b6d4',
    'Marcus Aurelius': 'f43f5e',
    'Grace Hopper': '10b981',
    'Alan Turing': 'f59e0b'
  };
  const color = colors[name] || '6366f1';
  return 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=' + color + '&color=fff&rounded=true&bold=true&size=48';
}

// Global Parser for raw Jira REST API v2/v3 responses
function parseJiraPayload(epicData, issuesList) {
  if (!epicData || !issuesList || !Array.isArray(issuesList)) {
    throw new Error('Invalid Jira API payloads. Ensure Epic issue details and search issues array are provided.');
  }

  // Helper to extract fields that might have dynamic names (like story points)
  function findStoryPoints(fields) {
    // 1. Check known standard story point custom fields first
    const knownKeys = ['customfield_10016', 'customfield_10008', 'customfield_10024', 'customfield_10030'];
    for (const key of knownKeys) {
      if (fields[key] !== undefined && typeof fields[key] === 'number') {
        return fields[key];
      }
    }

    // 2. Dynamic fallback: check if any other customfield_ is a number
    const keys = Object.keys(fields);
    for (const key of keys) {
      if (key.startsWith('customfield_') && typeof fields[key] === 'number') {
        return fields[key];
      }
    }
    
    // 3. Fallbacks for named properties
    return fields.storyPoints || fields['Story Points'] || fields['Story Point Estimate'] || null;
  }

  // Helper to extract sprint names from objects, arrays, or serialized strings
  function parseSprintName(fields) {
    if (fields.sprint) {
      if (typeof fields.sprint === 'object') return fields.sprint.name;
      if (typeof fields.sprint === 'string') {
        const match = fields.sprint.match(/name=([^,\]]+)/);
        if (match) return match[1];
        return fields.sprint;
      }
    }
    const cf = fields.customfield_10020;
    if (cf && Array.isArray(cf) && cf.length > 0) {
      const first = cf[0];
      if (first) {
        if (typeof first === 'object') return first.name;
        if (typeof first === 'string') {
          const match = first.match(/name=([^,\]]+)/);
          if (match) return match[1];
          return first;
        }
      }
    } else if (cf && typeof cf === 'string') {
      const match = cf.match(/name=([^,\]]+)/);
      if (match) return match[1];
      return cf;
    } else if (cf && typeof cf === 'object') {
      return cf.name || null;
    }
    return null;
  }

  // Helper to normalize descriptions (could be ADF or string)
  function parseDescription(desc) {
    if (!desc) return '';
    if (typeof desc === 'object') {
      return adfToMarkdown(desc);
    }
    return String(desc);
  }

  // Parse comments
  function parseComments(commentsObj) {
    if (!commentsObj || !Array.isArray(commentsObj.comments)) return [];
    return commentsObj.comments.map(c => {
      const authorName = c.author ? c.author.displayName : 'Anonymous';
      const rawAvatar = c.author && c.author.avatarUrls ? (c.author.avatarUrls['48x48'] || c.author.avatarUrls['24x24']) : null;
      return {
        author: authorName,
        avatar: getUserAvatarUrl(authorName, rawAvatar),
        content: parseDescription(c.body),
        created: c.created
      };
    });
  }

  // Parse links
  function parseLinks(issueKey, linksArray) {
    if (!linksArray || !Array.isArray(linksArray)) return [];
    const links = [];
    linksArray.forEach(l => {
      const isOutward = l.outwardIssue !== undefined;
      const linked = isOutward ? l.outwardIssue : l.inwardIssue;
      if (!linked) return;

      links.push({
        key: linked.key,
        summary: linked.fields ? linked.fields.summary : 'Linked Issue',
        type: linked.fields && linked.fields.issuetype ? linked.fields.issuetype.name : 'Task',
        status: linked.fields && linked.fields.status ? linked.fields.status.name : 'To Do',
        relation: isOutward ? (l.type ? l.type.outward : 'blocks') : (l.type ? l.type.inward : 'is blocked by')
      });
    });
    return links;
  }

  // Parse single issue
  function mapIssue(raw) {
    const fields = raw.fields || {};
    const key = raw.key;
    let type = fields.issuetype ? fields.issuetype.name : 'Task';
    const isSubtask = fields.issuetype && (fields.issuetype.subtask === true || type.toLowerCase().includes('sub-task') || type.toLowerCase().includes('subtask'));
    if (isSubtask) {
      type = 'Subtask';
    }
    const status = fields.status ? fields.status.name : 'To Do';
    const priority = fields.priority ? fields.priority.name : 'Medium';
    const assignee = fields.assignee ? {
      name: fields.assignee.displayName,
      avatar: fields.assignee.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
      avatarUrl: getUserAvatarUrl(fields.assignee.displayName, fields.assignee.avatarUrls ? (fields.assignee.avatarUrls['32x32'] || fields.assignee.avatarUrls['24x24']) : null)
    } : { name: 'Unassigned', avatar: 'UN', avatarUrl: null };

    const sprint = parseSprintName(fields);
    const storyPoints = findStoryPoints(fields);
    
    // Extract description and look for Acceptance Criteria
    const descText = parseDescription(fields.description);
    let description = descText;
    let acceptanceCriteria = [];

    // Simple heuristic to split Acceptance Criteria if written in description
    if (descText.includes('Acceptance Criteria') || descText.includes('AC:')) {
      const parts = descText.split(/Acceptance Criteria|AC\:/i);
      description = parts[0].trim();
      const acPart = (parts[1] || '').trim();
      if (acPart.indexOf('|') !== -1) {
        acceptanceCriteria = acPart;
      } else {
        acceptanceCriteria = acPart.split('\n')
          .map(line => line.trim().replace(/^-\s*|^\[\s*\]\s*|^\*\s*/, ''))
          .filter(line => line.length > 2);
      }
    }

    // Default acceptance criteria if none parsed but is a Story
    if (acceptanceCriteria.length === 0 && type === 'Story') {
      acceptanceCriteria = [
        'Functional requirements met and verified',
        'Unit tests added with >80% coverage',
        'Performance guidelines respected',
        'Documentation updated'
      ];
    }

    // History parsing - if available
    let history = [];
    if (raw.changelog && Array.isArray(raw.changelog.histories)) {
      raw.changelog.histories.forEach(h => {
        const author = h.author ? h.author.displayName : 'System';
        h.items.forEach(item => {
          history.push({
            author,
            field: item.field,
            from: item.fromString || 'None',
            to: item.toString || 'None',
            date: h.created
          });
        });
      });
    } else {
      // Create some default history
      history = [
        { author: assignee.name, field: 'status', from: 'To Do', to: status, date: fields.updated || fields.created }
      ];
    }

    const reporter = fields.reporter ? fields.reporter.displayName : 'Anonymous';
    const labels = fields.labels || [];

    const attachments = (fields.attachment || []).map(att => ({
      filename: att.filename,
      contentUrl: att.content,
      thumbnailUrl: att.thumbnail || null,
      mimeType: att.mimeType,
      size: att.size,
      created: att.created
    }));

    return {
      key,
      summary: fields.summary || 'No Summary',
      type,
      status,
      priority,
      assignee,
      reporter,
      sprint,
      storyPoints,
      created: fields.created,
      updated: fields.updated,
      description,
      acceptanceCriteria,
      comments: parseComments(fields.comment),
      linkedIssues: parseLinks(key, fields.issuelinks),
      parentKey: fields.parent ? fields.parent.key : null,
      subtasks: fields.subtasks ? fields.subtasks.map(s => s.key) : [],
      labels,
      history,
      iconUrl: getIssueIconUrl(type, fields.issuetype ? fields.issuetype.iconUrl : null),
      attachments
    };
  }

  // Parse Epic
  const parsedEpic = mapIssue(epicData);
  parsedEpic.type = 'Epic'; // Ensure type is Epic

  // Parse all issues in the list
  const parsedIssues = issuesList.map(mapIssue);

  // Link subtasks to their parents, ensure parentKeys are correct
  parsedIssues.forEach(issue => {
    if (issue.type === 'Subtask') {
      if (issue.parentKey) {
        // Ensure parent lists this subtask
        const parent = parsedIssues.find(p => p.key === issue.parentKey);
        if (parent) {
          if (!parent.subtasks.includes(issue.key)) {
            parent.subtasks.push(issue.key);
          }
        }
      } else {
        // Try to find parent by matching subtask arrays
        const parent = parsedIssues.find(p => p.subtasks && p.subtasks.includes(issue.key));
        if (parent) {
          issue.parentKey = parent.key;
        }
      }
    }
  });

  // Generate dynamic client-side AI analysis for all issues
  parsedIssues.forEach(issue => {
    issue.aiAnalysis = generateLocalAIAnalysis(issue);
  });
  parsedEpic.aiAnalysis = generateLocalAIAnalysis(parsedEpic, parsedIssues);

  return {
    epic: parsedEpic,
    issues: parsedIssues
  };
}

// Heuristics-based local AI Analysis Generator
function generateLocalAIAnalysis(issue, allIssues = []) {
  if (issue.type === 'Epic') {
    const total = allIssues.length;
    const completed = allIssues.filter(i => i.status === 'Done' || i.status === 'Resolved' || i.status === 'Closed').length;
    const open = total - completed;
    const blocked = allIssues.filter(i => i.status === 'Blocked' || i.status === 'Flagged' || i.linkedIssues.some(l => l.relation === 'is blocked by' && l.status !== 'Done')).length;
    
    return {
      summary: `Epic "${issue.summary}" represents a core strategic milestone. Currently, ${completed} out of ${total} issues are completed (${Math.round((completed/total)*100 || 0)}%). The stream is actively progressing but faces ${blocked} blocked paths.`,
      risks: [
        blocked > 0 ? `${blocked} tickets are currently in Blocked status, halting dependent tasks.` : 'No critical blocker active, but timeline integration remains tight.',
        allIssues.filter(i => i.priority === 'Highest' && i.status !== 'Done').length > 5 ? 'High concentration of unstarted Highest Priority tasks may compress testing phase.' : 'Priority distribution is balanced across the active sprint.'
      ],
      openQuestions: [
        'Are the external partner dependencies and environments fully verified for the next milestone?',
        'Do we need to split remaining scope to meet the upcoming quarterly release lock?'
      ],
      missingCriteria: [
        'End-to-end multi-party verification criteria are not specified at the Epic level.',
        'Load testing criteria for API endpoints'
      ],
      blockers: blocked > 0 ? [`Resolve blocking tickets in the stream: ${allIssues.filter(i => i.status === 'Blocked').map(i => i.key).join(', ')}`] : ['None detected']
    };
  }

  // Issue level AI summary generator
  const isBlocked = issue.status === 'Blocked' || issue.linkedIssues.some(l => l.relation === 'is blocked by');
  const typeText = issue.type.toLowerCase();
  
  return {
    summary: `This ${typeText} addresses critical requirements for "${issue.summary}". It is structured under ${issue.parentKey ? `parent issue ${issue.parentKey}` : 'the root Epic scope'}.`,
    risks: [
      isBlocked ? `Critical Risk: This issue is blocked by other tasks. Progress is stalled.` : `Technical complexity: Implementation needs integration tests with third-party webhooks.`,
      issue.storyPoints && issue.storyPoints > 8 ? `Estimation alert: Estimated at ${issue.storyPoints} Story Points, suggesting high risk and potential candidate for subtask decomposition.` : `Velocity: Work scope is estimated reasonably.`
    ],
    openQuestions: [
      `Has the load tolerance profile for this changes been reviewed by the Ops team?`,
      issue.type === 'Bug' ? `What is the regression blast radius for this payment flow change?` : `Are the failover paths fully defined in case of service downtime?`
    ],
    missingCriteria: [
      `Needs exact metrics definition for observability dashboards.`,
      `Fallback test scenarios under peak network latency.`
    ],
    blockers: isBlocked ? [`Wait for blocking issues: ${issue.linkedIssues.filter(l => l.relation === 'is blocked by').map(l => l.key).join(', ') || 'External dependency'}`] : [`None`]
  };
}

// ----------------------------------------------------
// DEFAULT HIGH-FIDELITY MOCK DATA (72 Tickets)
// ----------------------------------------------------
const MOCK_EPIC = {
  "key": "PROJ-100",
  "summary": "E-Commerce Checkout & Payment Gateway Modernization",
  "type": "Epic",
  "status": "In Progress",
  "priority": "High",
  "assignee": {
    "name": "Sarah Jenkins",
    "avatar": "SJ",
    "avatarUrl": "https://ui-avatars.com/api/?name=Sarah+Jenkins&background=8b5cf6&color=fff&rounded=true&bold=true&size=48"
  },
  "sprint": "Sprint 14 (Checkout & Payments)",
  "storyPoints": 24,
  "created": "2026-04-15T00:00:00Z",
  "updated": "2026-06-25T14:00:00Z",
  "description": "End-to-end modernization of the online shopping cart and checkout pipeline. Includes Stripe/PayPal multi-currency payment integration, saved credit card tokenization, persistent cart state across devices, and automated order confirmation webhooks.",
  "acceptanceCriteria": [
    "One-click checkout enabled for returning customers with saved payment methods.",
    "Support multi-currency display (USD, EUR, GBP, JPY) based on buyer geo-location.",
    "Shopping cart contents persist across browser restarts for logged-in users."
  ],
  "comments": [
    {
      "author": "Sarah Jenkins",
      "avatar": "SJ",
      "content": "Epic scope refined. 5 key user stories and subtasks active.",
      "created": "2026-06-20T10:00:00Z"
    }
  ],
  "linkedIssues": [],
  "parentKey": null,
  "subtasks": []
};

// Hand-crafted rich seeds
const seedIssues = [
  {
    "key": "PROJ-101",
    "summary": "Implement One-Click Checkout with Saved Credit Cards",
    "type": "Story",
    "status": "In Progress",
    "priority": "High",
    "assignee": {
      "name": "Sarah Jenkins",
      "avatar": "SJ",
      "avatarUrl": "https://ui-avatars.com/api/?name=Sarah+Jenkins&background=8b5cf6&color=fff&rounded=true&bold=true&size=48"
    },
    "reporter": "Sarah Jenkins",
    "sprint": "Sprint 14 (Checkout & Payments)",
    "storyPoints": 5,
    "created": "2026-04-30T01:57:39.555-0400",
    "updated": "2026-06-19T23:31:15.330-0400",
    "description": "## 📖 User Story\n\n**As an **Online Shopper, **I want **to save my payment card details securely during checkout, **So that **I can complete future orders with a single click without re-entering card details.\n\n\n## 🎯 Context & Background\n\nCheckout friction currently causes cart abandonment during mobile shopping. As part of the Checkout Modernization Epic (`PROJ-100`), customer payment method tokenization must be enabled via Stripe API integrations.\n\n\n## ✅ Acceptance Criteria\n\n- AC 1: Customers can select 'Save card for future purchases' during checkout.\n- AC 2: Card credentials are tokenized via Stripe Vault API (no raw card data stored).\n- AC 3: One-click express payment button appears on checkout summary for returning users.\n- AC 4: Unit tests and integration tests pass with >85% code coverage.",
    "acceptanceCriteria": [
      "AC 1: Payment method tokenization active via Stripe API.",
      "AC 2: One-click payment trigger completes order in under 2 seconds.",
      "AC 3: PCI-DSS compliance verification passed."
    ],
    "comments": [
      {
        "author": "Sarah Jenkins",
        "avatar": "SJ",
        "content": "Refinement completed during sprint planning: Acceptance Criteria and tokenization scope locked and approved.",
        "created": "2026-06-24T15:30:00.000-0400"
      }
    ],
    "linkedIssues": [],
    "parentKey": "PROJ-100",
    "subtasks": [
      "PROJ-105",
      "PROJ-106"
    ],
    "labels": [
      "checkout",
      "payments",
      "stripe-api",
      "refinement-approved",
      "ui-enhancement"
    ],
    "components": [
      "Checkout UI",
      "Payment Gateway Service"
    ]
  },
  {
    "key": "PROJ-102",
    "summary": "Shopping Cart Persistent State Across Sessions",
    "type": "Story",
    "status": "Done",
    "priority": "High",
    "assignee": {
      "name": "John Doe",
      "avatar": "JD",
      "avatarUrl": "https://ui-avatars.com/api/?name=John+Doe&background=6366f1&color=fff&rounded=true&bold=true&size=48"
    },
    "reporter": "Sarah Jenkins",
    "sprint": "Sprint 14 (Checkout & Payments)",
    "storyPoints": 5,
    "created": "2026-04-15T01:01:00.585-0400",
    "updated": "2026-06-23T01:09:55.261-0400",
    "description": "## 📖 User Story\n\n**As a **Customer, **I want **my shopping cart items preserved across browser sessions and mobile devices, **So that **I can resume shopping without losing my cart items.\n\n\n## 🎯 Context & Business Value\n\nCart drop-off occurs when users switch devices or return later to complete purchases. Persistent cart storage synchronizes local storage state with Redis session cache upon user login.\n\n\n## ✅ Acceptance Criteria\n\n- AC 1: Cart state synchronizes to user profile upon authentication.\n- AC 2: Cart items persist across browser restarts for up to 30 days.\n- AC 3: Out-of-stock items automatically prompt user for quantity adjustment.",
    "acceptanceCriteria": [
      "AC 1: Cart state synchronizes to user profile upon authentication.",
      "AC 2: Cart items persist across browser restarts for up to 30 days.",
      "AC 3: Out-of-stock items automatically prompt user for quantity adjustment."
    ],
    "comments": [
      {
        "author": "John Doe",
        "avatar": "JD",
        "content": "Verified cart synchronization in staging. Tested session recovery under edge network disconnects.",
        "created": "2026-06-20T11:00:00.000-0400"
      }
    ],
    "linkedIssues": [],
    "parentKey": "PROJ-100",
    "subtasks": [
      "PROJ-107"
    ],
    "labels": [
      "cart",
      "session",
      "redis",
      "ui-enhancement"
    ],
    "components": [
      "Cart UI",
      "Session Store"
    ]
  }
];

// Subtasks definition
const seedSubtasks = [
  {
    "key": "PROJ-105",
    "summary": "Unit Tests for Payment Token Validation Handler",
    "type": "Subtask",
    "status": "In Progress",
    "priority": "High",
    "assignee": {
      "name": "Sarah Jenkins",
      "avatar": "SJ"
    },
    "sprint": "Sprint 14 (Checkout & Payments)",
    "storyPoints": 1,
    "created": "2026-06-20T10:00:00Z",
    "updated": "2026-06-25T12:00:00Z",
    "description": "Subtask requirement for PROJ-101: Unit test coverage for Stripe token validation and error handling.",
    "acceptanceCriteria": [
      "Unit tests written with mock token payloads (>90% coverage)."
    ],
    "comments": [],
    "linkedIssues": [],
    "parentKey": "PROJ-101",
    "subtasks": []
  },
  {
    "key": "PROJ-106",
    "summary": "UI Components for Credit Card Input and CVV Masking",
    "type": "Subtask",
    "status": "Done",
    "priority": "High",
    "assignee": {
      "name": "John Doe",
      "avatar": "JD"
    },
    "sprint": "Sprint 14 (Checkout & Payments)",
    "storyPoints": 1,
    "created": "2026-06-20T10:00:00Z",
    "updated": "2026-06-25T12:00:00Z",
    "description": "Subtask requirement for PROJ-101: Build credit card number, expiration date, and CVV security masking UI fields.",
    "acceptanceCriteria": [
      "Input fields format card numbers dynamically with vendor icon auto-detection."
    ],
    "comments": [],
    "linkedIssues": [],
    "parentKey": "PROJ-101",
    "subtasks": []
  }
];

// Programmatic Generator for Graph-Optimized Curated Dataset (13 Interconnected Tickets)
function generateFullMockData() {
  const issues = [];
  
  // Add seed issues and subtasks
  seedIssues.forEach(item => {
    issues.push(JSON.parse(JSON.stringify(item)));
  });
  seedSubtasks.forEach(item => {
    issues.push(JSON.parse(JSON.stringify(item)));
  });

  // Curated additional graph-optimized stories, bugs, and tasks
  const additionalGraphIssues = [
    {
      key: "PROJ-103",
      summary: "Multi-Currency Rate Conversion Engine (USD, EUR, GBP)",
      type: "Story",
      status: "In Progress",
      priority: "High",
      assignee: { name: "Ada Lovelace", avatar: "AL", avatarUrl: "https://ui-avatars.com/api/?name=Ada+Lovelace&background=06b6d4&color=fff&rounded=true&bold=true&size=48" },
      reporter: "Sarah Jenkins",
      sprint: "Sprint 14 (Checkout & Payments)",
      storyPoints: 5,
      created: "2026-05-02T10:00:00Z",
      updated: "2026-06-20T12:00:00Z",
      description: "Display real-time currency conversion rates during checkout based on the buyer's region using live exchange rate APIs.",
      acceptanceCriteria: ["AC 1: Converts order total to buyer region currency.", "AC 2: Rates update hourly with fallback cache."],
      comments: [{ author: "Ada Lovelace", avatar: "AL", content: "Exchange rate API integration completed. Testing multi-currency checkout calculation.", created: "2026-06-21T10:00:00Z" }],
      linkedIssues: [{ key: "PROJ-101", relation: "blocks", title: "One-Click Checkout needs currency rate engine", status: "In Progress" }],
      parentKey: "PROJ-100",
      subtasks: ["PROJ-108"]
    },
    {
      key: "PROJ-104",
      summary: "Fix Order Summary Total Calculation on Discount Coupon Applied",
      type: "Bug",
      status: "In Review",
      priority: "Highest",
      assignee: { name: "Marcus Aurelius", avatar: "MA", avatarUrl: "https://ui-avatars.com/api/?name=Marcus+Aurelius&background=f43f5e&color=fff&rounded=true&bold=true&size=48" },
      reporter: "Sarah Jenkins",
      sprint: "Sprint 14 (Checkout & Payments)",
      storyPoints: 3,
      created: "2026-05-10T10:00:00Z",
      updated: "2026-06-22T14:00:00Z",
      description: "Resolves a display bug where coupon discounts were not deducting tax correctly on the final payment review step.",
      acceptanceCriteria: ["AC 1: Tax re-evaluates after promo discount application.", "AC 2: Zero rounding discrepancies on order subtotal."],
      comments: [{ author: "Marcus Aurelius", avatar: "MA", content: "Fix submitted for code review. PR #142 ready.", created: "2026-06-23T09:00:00Z" }],
      linkedIssues: [{ key: "PROJ-101", relation: "blocks", title: "Checkout payment calculations depend on correct coupon discount tax logic", status: "In Progress" }],
      parentKey: "PROJ-100",
      subtasks: ["PROJ-109"]
    },
    {
      key: "PROJ-107",
      summary: "Sync Cart LocalStorage with Redis Cache",
      type: "Subtask",
      status: "Done",
      priority: "High",
      assignee: { name: "John Doe", avatar: "JD" },
      sprint: "Sprint 14 (Checkout & Payments)",
      storyPoints: 1,
      created: "2026-06-15T10:00:00Z",
      updated: "2026-06-22T12:00:00Z",
      description: "Subtask requirement for PROJ-102: Synchronize local browser cart state with Redis session cache upon user login.",
      acceptanceCriteria: ["Cart state synchronizes upon login event."],
      comments: [],
      linkedIssues: [],
      parentKey: "PROJ-102",
      subtasks: []
    },
    {
      key: "PROJ-108",
      summary: "Integrate OpenExchangeRates API Feed",
      type: "Subtask",
      status: "In Progress",
      priority: "High",
      assignee: { name: "Ada Lovelace", avatar: "AL" },
      sprint: "Sprint 14 (Checkout & Payments)",
      storyPoints: 2,
      created: "2026-06-16T10:00:00Z",
      updated: "2026-06-22T12:00:00Z",
      description: "Subtask requirement for PROJ-103: Connect OpenExchangeRates API feed for hourly currency conversion updates.",
      acceptanceCriteria: ["API rate feed successfully cached in Redis."],
      comments: [],
      linkedIssues: [],
      parentKey: "PROJ-103",
      subtasks: []
    },
    {
      key: "PROJ-109",
      summary: "Recalculate Tax Matrix on Promo Code Applied",
      type: "Subtask",
      status: "In Review",
      priority: "High",
      assignee: { name: "Marcus Aurelius", avatar: "MA" },
      sprint: "Sprint 14 (Checkout & Payments)",
      storyPoints: 1,
      created: "2026-06-17T10:00:00Z",
      updated: "2026-06-23T12:00:00Z",
      description: "Subtask requirement for PROJ-104: Recalculate tax matrix on discount coupon application.",
      acceptanceCriteria: ["Tax matrix recalculates correctly."],
      comments: [],
      linkedIssues: [],
      parentKey: "PROJ-104",
      subtasks: []
    },
    {
      key: "PROJ-110",
      summary: "Configure Payment Webhooks & Order Confirmation Notifications",
      type: "Task",
      status: "In Review",
      priority: "Medium",
      assignee: { name: "Grace Hopper", avatar: "GH", avatarUrl: "https://ui-avatars.com/api/?name=Grace+Hopper&background=10b981&color=fff&rounded=true&bold=true&size=48" },
      reporter: "Sarah Jenkins",
      sprint: "Sprint 14 (Checkout & Payments)",
      storyPoints: 2,
      created: "2026-05-15T10:00:00Z",
      updated: "2026-06-24T12:00:00Z",
      description: "Configure async payment success/failure webhook event listeners and trigger order confirmation emails via SendGrid.",
      acceptanceCriteria: ["AC 1: Webhook payload validated with HMAC signature.", "AC 2: Email confirmation sent within 5 seconds of payment."],
      comments: [],
      linkedIssues: [{ key: "PROJ-101", relation: "relates to", title: "Triggers notification upon express checkout completion", status: "In Progress" }],
      parentKey: "PROJ-100",
      subtasks: ["PROJ-111"]
    },
    {
      key: "PROJ-111",
      summary: "Setup Webhook Secret HMAC Signature Validator",
      type: "Subtask",
      status: "Done",
      priority: "High",
      assignee: { name: "Grace Hopper", avatar: "GH" },
      sprint: "Sprint 14 (Checkout & Payments)",
      storyPoints: 1,
      created: "2026-06-18T10:00:00Z",
      updated: "2026-06-24T12:00:00Z",
      description: "Subtask requirement for PROJ-110: Verify Stripe and PayPal webhook signatures using SHA-256 HMAC digest.",
      acceptanceCriteria: ["HMAC validation active on webhook endpoint."],
      comments: [],
      linkedIssues: [],
      parentKey: "PROJ-110",
      subtasks: []
    },
    {
      key: "PROJ-112",
      summary: "Database Migration for PCI Compliance Audit Vault",
      type: "Task",
      status: "Done",
      priority: "High",
      assignee: { name: "Alan Turing", avatar: "AT", avatarUrl: "https://ui-avatars.com/api/?name=Alan+Turing&background=f59e0b&color=fff&rounded=true&bold=true&size=48" },
      reporter: "Sarah Jenkins",
      sprint: "Sprint 14 (Checkout & Payments)",
      storyPoints: 3,
      created: "2026-05-20T10:00:00Z",
      updated: "2026-06-25T12:00:00Z",
      description: "Database migration creating encrypted audit log tables for transaction events to satisfy PCI-DSS compliance requirements.",
      acceptanceCriteria: ["AC 1: Encrypted table created with KMS customer-managed key.", "AC 2: Audit log retention policy set to 7 years."],
      comments: [],
      linkedIssues: [],
      parentKey: "PROJ-100",
      subtasks: ["PROJ-113"]
    },
    {
      key: "PROJ-113",
      summary: "Encrypt Card Tokens in Audit Vault DB Schema",
      type: "Subtask",
      status: "Done",
      priority: "High",
      assignee: { name: "Alan Turing", avatar: "AT" },
      sprint: "Sprint 14 (Checkout & Payments)",
      storyPoints: 1,
      created: "2026-06-19T10:00:00Z",
      updated: "2026-06-25T12:00:00Z",
      description: "Subtask requirement for PROJ-112: AES-256 column encryption on payment token audit fields.",
      acceptanceCriteria: ["Column level encryption verified."],
      comments: [],
      linkedIssues: [],
      parentKey: "PROJ-112",
      subtasks: []
    }
  ];

  additionalGraphIssues.forEach(item => {
    issues.push(JSON.parse(JSON.stringify(item)));
  });

  // Set mock icons, avatars, and AI analysis for all 13 graph tickets
  issues.forEach(issue => {
    issue.iconUrl = getIssueIconUrl(issue.type);
    if (issue.assignee) {
      issue.assignee.avatarUrl = getUserAvatarUrl(issue.assignee.name);
    }
    if (issue.comments) {
      issue.comments.forEach(c => {
        c.avatar = getUserAvatarUrl(c.author);
      });
    }
    if (issue.key === 'PROJ-101') {
      issue.attachments = [
        {
          filename: 'stripe_checkout_flow.png',
          contentUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80',
          thumbnailUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=150&q=80',
          mimeType: 'image/png',
          size: 245100,
          created: '2026-05-18T14:22:00Z'
        }
      ];
    } else {
      issue.attachments = [];
    }

    issue.aiAnalysis = generateLocalAIAnalysis(issue);
  });

  const parsedEpic = JSON.parse(JSON.stringify(MOCK_EPIC));
  parsedEpic.iconUrl = getIssueIconUrl('Epic');
  if (parsedEpic.assignee) {
    parsedEpic.assignee.avatarUrl = getUserAvatarUrl(parsedEpic.assignee.name);
  }
  if (parsedEpic.comments) {
    parsedEpic.comments.forEach(c => {
      c.avatar = getUserAvatarUrl(c.author);
    });
  }
  parsedEpic.attachments = [
    {
      filename: 'payment_modernization_architecture.png',
      contentUrl: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=800&q=80',
      thumbnailUrl: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=150&q=80',
      mimeType: 'image/png',
      size: 382400,
      created: '2026-04-10T08:00:00Z'
    }
  ];
  parsedEpic.aiAnalysis = generateLocalAIAnalysis(parsedEpic, issues);

  return {
    epic: parsedEpic,
    issues: issues
  };
}

// Global Exports
window.JiraParser = {
  parseJiraPayload: parseJiraPayload,
  getMockData: generateFullMockData,
  getUserAvatarUrl: getUserAvatarUrl
};
