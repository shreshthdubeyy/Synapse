/**
 * Synapse Google Apps Script (GAS) Proxy Template
 * ================================================
 * 
 * This script acts as a secure backend proxy to bypass browser CORS restrictions
 * when connecting to live Atlassian Jira environments, and keeps your API tokens 
 * hidden from the client-side frontend.
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Go to https://script.google.com/ and create a new project.
 * 2. Paste this entire code into the Code.gs file.
 * 3. Go to Project Settings (the gear icon on the left).
 * 4. Under "Script Properties", add the following key-value pairs:
 *    - JIRA_HOST : Your Jira URL (e.g., https://yourcompany.atlassian.net)
 *    - JIRA_EMAIL : Your Atlassian account email
 *    - JIRA_TOKEN : Your Atlassian API Token
 *    - OPENROUTER_API_KEY : Your OpenRouter/Gemini API key for AI Insights
 * 5. Click "Deploy" > "New deployment" in the top right.
 * 6. Select type "Web app".
 * 7. Set "Execute as" to "Me" and "Who has access" to "Anyone".
 * 8. Copy the generated Web App URL and paste it into your `app.js` file as `GOOGLE_SCRIPT_URL`.
 */

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const scriptProperties = PropertiesService.getScriptProperties();
    
    // Check if the action is for Gemini AI Analysis
    if (params.action === 'gemini') {
      const openrouterApiKey = scriptProperties.getProperty("OPENROUTER_API_KEY");
      if (!openrouterApiKey) {
        return ContentService.createTextOutput(JSON.stringify({
          statusCode: 400,
          error: "OPENROUTER_API_KEY script property is not configured in Google Apps Script settings."
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }
      
      let promptText = params.prompt;
      if (!promptText) {
        const issue = params.issue || {};
        const commentsText = issue.commentsText || 'None';
        const linksText = issue.linksText || 'None';
        const acText = issue.acceptanceCriteria || 'None';
        
        promptText = "Analyze the following Jira issue. Understand its requirements, status, complexity, comments, and links to identify key delivery insights.\n\n" +
          "Issue Details:\n" +
          "Key: " + (issue.key || '') + "\n" +
          "Type: " + (issue.type || '') + "\n" +
          "Summary: " + (issue.summary || '') + "\n" +
          "Status: " + (issue.status || '') + "\n" +
          "Priority: " + (issue.priority || '') + "\n" +
          "Assignee: " + (issue.assignee || '') + "\n" +
          "Sprint: " + (issue.sprint || '') + "\n" +
          "Story Points: " + (issue.storyPoints || '') + "\n" +
          "Description: " + (issue.description || '') + "\n" +
          "Acceptance Criteria:\n" + acText + "\n" +
          "Comments:\n" + commentsText + "\n" +
          "Linked Issues:\n" + linksText + "\n\n" +
          "You MUST respond with a raw JSON object with the following fields (do not wrap in markdown quotes, return ONLY the raw JSON text):\n" +
          "{\n" +
          "  \"summary\": \"1-2 sentence quick engineering summary of the issue.\",\n" +
          "  \"risks\": [\"Risk 1 regarding technical implementation or status\", \"Risk 2...\"],\n" +
          "  \"openQuestions\": [\"Question 1 regarding scope ambiguity or dependency\", \"Question 2...\"],\n" +
          "  \"missingCriteria\": [\"Missing acceptance criteria 1...\", \"Missing AC 2...\"],\n" +
          "  \"blockers\": [\"Actionable blocker 1...\", \"Actionable blocker 2...\"]\n" +
          "}";
      }
        
      const openrouterUrl = "https://openrouter.ai/api/v1/chat/completions";
      const requestPayload = {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: promptText }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500
      };
      
      const resp = UrlFetchApp.fetch(openrouterUrl, {
        method: "post",
        headers: {
          "Authorization": "Bearer " + openrouterApiKey,
          "HTTP-Referer": "http://localhost",
          "X-Title": "Synapse"
        },
        contentType: "application/json",
        payload: JSON.stringify(requestPayload),
        muteHttpExceptions: true
      });
      
      if (resp.getResponseCode() !== 200) {
        return ContentService.createTextOutput(JSON.stringify({
          statusCode: resp.getResponseCode(),
          error: "OpenRouter API returned error: " + resp.getContentText()
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }
      
      const resJson = JSON.parse(resp.getContentText());
      if (!resJson.choices || resJson.choices.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({
          statusCode: 500,
          error: "OpenRouter API returned no choices: " + resp.getContentText()
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }

      const text = resJson.choices[0].message.content;
      const parsedAI = JSON.parse(text);
      
      return ContentService.createTextOutput(JSON.stringify({
        statusCode: 200,
        analysis: parsedAI
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Retrieve credentials securely from Apps Script Project Properties (Private/Stored in Google Cloud)
    const JIRA_HOST = scriptProperties.getProperty("JIRA_HOST");
    const JIRA_EMAIL = scriptProperties.getProperty("JIRA_EMAIL");
    const JIRA_TOKEN = scriptProperties.getProperty("JIRA_TOKEN");
    
    // Fall back to request parameters if Script Properties are not defined
    const host = (JIRA_HOST || params.host || "").replace(/\/$/, "");
    const email = JIRA_EMAIL || params.email;
    const token = JIRA_TOKEN || params.token;
    
    if (!host || !email || !token) {
      return ContentService.createTextOutput(JSON.stringify({
        statusCode: 401,
        code: "JIRA_CREDENTIALS_MISSING",
        error: "Jira connection credentials not configured in Apps Script properties."
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }
    
    const authString = Utilities.base64Encode(email + ":" + token);
    const headers = {
      "Authorization": "Basic " + authString,
      "Accept": "application/json"
    };

    const TICKET_PREFIX = "FMS";
    const TICKET_SEPARATOR = "-";

    function formatKey(key) {
      if (!key) return key;
      if (/^\d+$/.test(String(key).trim())) {
        return TICKET_PREFIX + TICKET_SEPARATOR + String(key).trim();
      }
      return key;
    }

    const epicId = formatKey(params.epicId);
    const issueKey = formatKey(params.issueKey);

    if (issueKey) {
      const url = host + "/rest/api/2/issue/" + issueKey + "?expand=changelog";
      const resp = UrlFetchApp.fetch(url, { headers: headers, muteHttpExceptions: true });
      return ContentService.createTextOutput(JSON.stringify({
        statusCode: resp.getResponseCode(),
        body: resp.getContentText()
      }))
      .setMimeType(ContentService.MimeType.JSON);
    } else {
      const epicUrl = host + "/rest/api/2/issue/" + epicId + "?expand=changelog";
      const epicResp = UrlFetchApp.fetch(epicUrl, { headers: headers, muteHttpExceptions: true });
      if (epicResp.getResponseCode() !== 200) {
        return ContentService.createTextOutput(JSON.stringify({
          statusCode: epicResp.getResponseCode(),
          body: epicResp.getContentText()
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }

      // Try multiple JQL formats to cover all Jira Cloud Project Configurations (modern vs team-managed vs legacy)
      let searchResp;
      const fieldsParam = "summary,status,issuetype,subtasks,assignee,priority,description,parent,comment,issuelinks,created,updated,labels,reporter,attachment,customfield_10020,customfield_10016,customfield_10008,customfield_10024,customfield_10030,customfield_10005";

      // Try 1: Modern Jira Cloud Unified Hierarchy (parent = epicId)
      let JQL = "parent = " + epicId;
      let searchUrl = host + "/rest/api/2/search/jql?jql=" + encodeURIComponent(JQL) + "&maxResults=100&expand=changelog&fields=" + encodeURIComponent(fieldsParam);
      searchResp = UrlFetchApp.fetch(searchUrl, { headers: headers, muteHttpExceptions: true });

      // Try 2: Team-Managed Project Alias (parentEpic = epicId)
      if (searchResp.getResponseCode() !== 200) {
        JQL = "parentEpic = " + epicId;
        searchUrl = host + "/rest/api/2/search/jql?jql=" + encodeURIComponent(JQL) + "&maxResults=100&expand=changelog&fields=" + encodeURIComponent(fieldsParam);
        searchResp = UrlFetchApp.fetch(searchUrl, { headers: headers, muteHttpExceptions: true });
      }

      // Try 3: Legacy Company-Managed Field ('Epic Link' = epicId)
      if (searchResp.getResponseCode() !== 200) {
        JQL = "'Epic Link' = " + epicId;
        searchUrl = host + "/rest/api/2/search/jql?jql=" + encodeURIComponent(JQL) + "&maxResults=100&expand=changelog&fields=" + encodeURIComponent(fieldsParam);
        searchResp = UrlFetchApp.fetch(searchUrl, { headers: headers, muteHttpExceptions: true });
      }

      // If all queries fail, return the error
      if (searchResp.getResponseCode() !== 200) {
        return ContentService.createTextOutput(JSON.stringify({
          statusCode: searchResp.getResponseCode(),
          error: "Jira Search API failed with response: " + searchResp.getContentText()
        }))
        .setMimeType(ContentService.MimeType.JSON);
      }

      const searchResult = JSON.parse(searchResp.getContentText());
      const primaryIssues = searchResult.issues || [];
      
      // Fetch subtasks for all found issues to ensure nested subtask hierarchy loads fully
      if (primaryIssues.length > 0) {
        const primaryKeys = primaryIssues.map(function(issue) { return issue.key; });
        const subtasksJQL = "parent in (" + primaryKeys.join(",") + ")";
        const subtasksUrl = host + "/rest/api/2/search/jql?jql=" + encodeURIComponent(subtasksJQL) + "&maxResults=100&expand=changelog&fields=" + encodeURIComponent(fieldsParam);
        const subtasksResp = UrlFetchApp.fetch(subtasksUrl, { headers: headers, muteHttpExceptions: true });
        
        if (subtasksResp.getResponseCode() === 200) {
          const subtasksResult = JSON.parse(subtasksResp.getContentText());
          const subtasksIssues = subtasksResult.issues || [];
          searchResult.issues = primaryIssues.concat(subtasksIssues);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        statusCode: 200,
        epic: JSON.parse(epicResp.getContentText()),
        search: searchResult
      }))
      .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
  }
}
