/**
 * Synapse - Combined Jira Delivery Tools (Release Notes & JSON Trimmer)
 */
(function() {
  const GOOGLE_SCRIPT_URL = window.GOOGLE_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbwXR9LB1RgpkITXJv7HqAMcE3IuYKF1BzWWbEZJc0ZaUzvUI0OjWrxGUNqnkuRH6A5t3A/exec";

  function isLocalEnvironment() {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '' || window.location.protocol === 'file:';
  }

  function getSampleDemoTicket(key) {
    const formattedKey = key || 'PROJ-101';
    return {
      key: formattedKey,
      summary: 'Implement One-Click Express Checkout with Saved Payment Cards',
      description: 'Upgrade the e-commerce checkout flow to enable one-click express payment for returning customers. Integrate Stripe Vault API for credit card tokenization, implement instant payment verification, and display real-time order status notifications.',
      type: 'Story',
      comments: [
        { author: 'Sarah Jenkins', content: 'Verified payment token exchange latency is below 30ms in staging environment.' },
        { author: 'Marcus Chen', content: 'Configured automated order confirmation webhook listener.' }
      ]
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initTopNav();
    initReleaseNotesView();
    initTrimmerView();
  });

  // --- THEME SYSTEM ---
  function initTheme() {
    const savedTheme = localStorage.getItem('synapse-theme') || 'dark';
    document.documentElement.className = savedTheme;
    updateThemeIcon(savedTheme);

    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.className;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.className = newTheme;
        localStorage.setItem('synapse-theme', newTheme);
        updateThemeIcon(newTheme);
      });
    }
  }

  function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
      icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }
  }

  // --- TOP TOOL NAVIGATION ---
  function initTopNav() {
    const navRelease = document.getElementById('nav-release-link');
    const navTrimmer = document.getElementById('nav-trimmer-link');
    const releaseView = document.getElementById('release-notes-view');
    const trimmerView = document.getElementById('trimmer-view');

    if (navRelease && navTrimmer) {
      navRelease.addEventListener('click', (e) => {
        e.preventDefault();
        navRelease.classList.add('active');
        navTrimmer.classList.remove('active');
        releaseView.classList.add('active');
        releaseView.style.display = 'flex';
        trimmerView.classList.remove('active');
        trimmerView.style.display = 'none';
      });

      navTrimmer.addEventListener('click', (e) => {
        e.preventDefault();
        navTrimmer.classList.add('active');
        navRelease.classList.remove('active');
        trimmerView.classList.add('active');
        trimmerView.style.display = 'flex';
        releaseView.classList.remove('active');
        releaseView.style.display = 'none';
      });
    }
  }

  // ==========================================
  // 1. RELEASE NOTES GENERATOR VIEW
  // ==========================================
  function initReleaseNotesView() {
    const btnTabFetch = document.getElementById('btn-input-tab-fetch');
    const btnTabPaste = document.getElementById('btn-input-tab-paste');
    const tabFetchContent = document.getElementById('release-tab-fetch-content');
    const tabPasteContent = document.getElementById('release-tab-paste-content');

    const inputKey = document.getElementById('release-issue-key');
    const btnFetchGenerate = document.getElementById('btn-release-fetch-generate');

    const textareaJson = document.getElementById('release-raw-json');
    const btnPasteGenerate = document.getElementById('btn-release-paste-generate');
    const btnTrimJson = document.getElementById('btn-release-trim-json');

    const statusContainer = document.getElementById('release-status-container');
    const statusText = document.getElementById('release-status-text');
    const errorBanner = document.getElementById('release-error-banner');
    const errorMessage = document.getElementById('release-error-message');

    const emptyState = document.getElementById('release-empty-state');
    const resultsContainer = document.getElementById('release-results-container');
    const summaryKey = document.getElementById('release-summary-key');
    const summaryType = document.getElementById('release-summary-type');
    const summaryTitle = document.getElementById('release-summary-title');
    const variationsList = document.getElementById('release-variations-list');

    if (inputKey) {
      inputKey.addEventListener('blur', () => {
        let val = inputKey.value.trim().toUpperCase();
        if (/^\d+$/.test(val)) {
          inputKey.value = 'FMS-' + val;
        }
      });
    }

    if (btnTabFetch && btnTabPaste) {
      btnTabFetch.addEventListener('click', () => {
        btnTabFetch.classList.add('active');
        btnTabPaste.classList.remove('active');
        tabFetchContent.classList.add('active');
        tabFetchContent.style.display = 'block';
        tabPasteContent.classList.remove('active');
        tabPasteContent.style.display = 'none';
        hideError();
      });

      btnTabPaste.addEventListener('click', () => {
        btnTabPaste.classList.add('active');
        btnTabFetch.classList.remove('active');
        tabPasteContent.classList.add('active');
        tabPasteContent.style.display = 'block';
        tabFetchContent.classList.remove('active');
        tabFetchContent.style.display = 'none';
        hideError();
      });
    }

    if (btnPasteGenerate) {
      btnPasteGenerate.addEventListener('click', async () => {
        hideError();
        const jsonText = textareaJson.value.trim();
        if (!jsonText) {
          showError('Please paste a Jira ticket JSON payload.');
          return;
        }

        let issueData;
        try {
          const parsed = JSON.parse(jsonText);
          if (parsed.key) {
            issueData = {
              key: parsed.key,
              summary: parsed.fields?.summary || parsed.summary || 'No summary available',
              description: parsed.fields?.description || parsed.description || 'No description available',
              type: parsed.fields?.issuetype?.name || parsed.type || 'Story',
              comments: (parsed.fields?.comment?.comments || parsed.comments || []).map(c => ({
                author: c.author?.displayName || c.author || 'User',
                content: c.body || c.content || ''
              }))
            };
          } else {
            showError('Invalid JSON structure. It must contain a "key" and fields like "summary" and "description".');
            return;
          }
        } catch (e) {
          showError('Failed to parse JSON: ' + e.message);
          return;
        }

        await generateReleaseNotes(issueData);
      });
    }

    if (btnTrimJson) {
      btnTrimJson.addEventListener('click', () => {
        hideError();
        const jsonText = textareaJson.value.trim();
        if (!jsonText) {
          showError('Please paste a Jira ticket JSON payload first.');
          return;
        }

        try {
          const parsed = JSON.parse(jsonText);
          let issueObj = parsed;
          if (Array.isArray(parsed)) {
            issueObj = parsed[0] || {};
          } else if (parsed.issues && Array.isArray(parsed.issues)) {
            issueObj = parsed.issues[0] || {};
          } else if (parsed.issue) {
            issueObj = parsed.issue;
          }

          const key = issueObj.key || (issueObj.fields && issueObj.fields.key) || '';
          if (key) {
            const rawSummary = issueObj.fields?.summary || issueObj.summary || 'No summary available';
            const rawDescription = issueObj.fields?.description || issueObj.description || 'No description available';
            
            const cleanSummary = typeof rawSummary === 'object' && typeof adfToMarkdown === 'function'
              ? adfToMarkdown(rawSummary)
              : String(rawSummary);

            const cleanDescription = typeof rawDescription === 'object' && typeof adfToMarkdown === 'function'
              ? adfToMarkdown(rawDescription)
              : String(rawDescription);

            const trimmed = {
              key: key,
              summary: cleanSummary.trim(),
              description: cleanDescription.trim()
            };

            const type = issueObj.fields?.issuetype?.name || issueObj.type;
            if (type) trimmed.type = type;

            textareaJson.value = JSON.stringify(trimmed, null, 2);
          } else {
            showError('Invalid JSON structure. It must contain a "key" field.');
          }
        } catch (e) {
          showError('Failed to parse JSON: ' + e.message);
        }
      });
    }

    if (btnFetchGenerate) {
      btnFetchGenerate.addEventListener('click', async () => {
        hideError();
        let key = inputKey.value.trim().toUpperCase();
        if (!key) {
          showError('Please enter a valid Jira issue key (e.g. 101 or FMS-101).');
          return;
        }

        if (/^\d+$/.test(key)) {
          key = 'PROJ-' + key;
          inputKey.value = key;
        }

        showLoading('Loading sample ticket payload for Gemini AI...');
        await new Promise(r => setTimeout(r, 400));
        const demoIssue = getSampleDemoTicket(key);
        await generateReleaseNotes(demoIssue);
      });
    }

    function showLoading(msg) {
      if (statusText) statusText.textContent = msg;
      if (statusContainer) statusContainer.style.display = 'block';
    }

    function hideLoading() {
      if (statusContainer) statusContainer.style.display = 'none';
    }

    function showError(msg) {
      if (errorMessage) errorMessage.textContent = msg;
      if (errorBanner) errorBanner.style.display = 'flex';
    }

    function hideError() {
      if (errorBanner) errorBanner.style.display = 'none';
    }

    async function generateReleaseNotes(issue) {
      showLoading('Formulating Gemini release note prompt...');
      
      const commentsText = (issue.comments || []).map(c => `${c.author}: ${c.content}`).join('\n') || 'None';
      const cleanDesc = (issue.description || '').substring(0, 1500);
      
      const prompt = `Task: Read the following Jira ticket JSON and generate a single user-facing release note.

Rules:
1. Write in clear, professional, user-facing business language.
2. Focus on explaining both WHAT changed and WHY it matters to the user, ensuring the explanation is concrete rather than generic.
3. Generate only ONE response.
4. Start with a short introductory sentence (1 line) introducing the update.
5. Add 3-5 key highlights using bullet points. Each bullet point MUST specify the exact change and describe its direct value or outcome (e.g. explain how it saves time, prevents confusion, resolves a common friction point, or provides critical visibility).
6. End with a one-line user benefit statement summarizing the overall business or user value of this update.
7. Avoid generic placeholders and empty marketing jargon (like "improved user experience", "enhanced efficiency", or "streamlined workflow"). Instead, use the specific details from the Jira ticket to explain the actual value.
8. While avoiding low-level technical jargon (like SQL queries, database configurations, or variable names), do mention user-relevant system behaviors, new input fields, options, or report columns so users know exactly what they can do now.
9. Keep the total response under 200 words to ensure it remains descriptive and benefit-driven, yet concise.
10. Derive the content only from the Jira ticket information provided.
11. Select the most appropriate section header for the highlights bullet points from this list:
    - "What’s new:" (typically for new features/stories)
    - "What’s improved:" (typically for bug fixes/optimizations)
    - "Quick benefits:" (typically for general highlights)
    - "Enhancement highlights:" (typically for standard features)
    - "Why this helps:" (typically for user-value focused changes)

Jira Ticket Details:
Key: ${issue.key}
Type: ${issue.type}
Summary: ${issue.summary}
Description: ${cleanDesc}
Comments: ${commentsText}

You MUST respond with a raw JSON object with the following structure (do NOT wrap in markdown quotes, return ONLY the raw JSON text):
{
  "intro": "Short introductory sentence...",
  "header": "Selected header from the list (exactly as written, e.g. 'What’s new:')",
  "highlights": [
    "Descriptive point 1 explaining what changed and its benefit...",
    "Descriptive point 2 explaining what changed and its benefit...",
    "Descriptive point 3 explaining what changed and its benefit..."
  ],
  "benefit": "One-line user benefit statement..."
}`;

      showLoading('Running Gemini AI Generation...');
      try {
        if (!GOOGLE_SCRIPT_URL) throw new Error('Google Apps Script URL is not configured.');

        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'gemini', prompt: prompt })
        });

        if (!response.ok) throw new Error(`Proxy returned status ${response.status}`);

        const resJson = await response.json();
        if (resJson.error) throw new Error(`Google Apps Script: ${resJson.error}`);

        const parsedAI = resJson.analysis;
        if (!parsedAI || !parsedAI.intro || !Array.isArray(parsedAI.highlights) || !parsedAI.benefit) {
          throw new Error('Gemini response format is missing expected release note fields (intro, highlights, benefit).');
        }

        const allowedHeaders = [
          "What’s new:", "What's new:", "What’s improved:", "What's improved:",
          "Quick benefits:", "Enhancement highlights:", "Why this helps:"
        ];
        
        let header = parsedAI.header || '';
        if (!header || !allowedHeaders.some(h => header.toLowerCase().trim() === h.toLowerCase().trim())) {
          const typeLower = (issue.type || 'story').toLowerCase();
          if (typeLower.includes('bug')) {
            header = 'What’s improved:';
          } else if (typeLower.includes('story') || typeLower.includes('epic')) {
            header = 'What’s new:';
          } else {
            header = 'Enhancement highlights:';
          }
        }
        
        if (header.includes("'")) header = header.replace(/'/g, '’');
        parsedAI.header = header;

        renderReleaseNotes(issue, parsedAI);
      } catch (err) {
        console.error(err);
        showError(`AI Generation failed: ${err.message}`);
      } finally {
        hideLoading();
      }
    }

    function renderReleaseNotes(issue, releaseNote) {
      if (summaryKey) summaryKey.textContent = issue.key;
      if (summaryType) {
        summaryType.textContent = issue.type;
        summaryType.className = `type-badge ${issue.type.toLowerCase()}`;
      }
      if (summaryTitle) summaryTitle.textContent = issue.summary;

      variationsList.innerHTML = '';
      
      const card = document.createElement('div');
      card.className = 'release-variation-card';
      
      const plainTextHighlights = releaseNote.highlights.map(h => `* ${h}`).join('\n');
      const headerText = releaseNote.header || 'Enhancement highlights:';
      const fullPlainText = `${issue.summary}\n${releaseNote.intro}\n\n${headerText}\n\n${plainTextHighlights}\n\n${releaseNote.benefit}`;
      
      card.innerHTML = `
        <div class="release-card-header">
          <span class="release-card-badge" style="background: var(--grad-primary); color: #fff; border: none;">Official Release Note</span>
          <button class="release-copy-btn" title="Copy to clipboard">
            <span class="material-symbols-outlined" style="font-size: 14px;">content_copy</span>
            <span>Copy</span>
          </button>
        </div>
        <div class="release-card-title" style="font-size: 14px; font-weight: 700; color: var(--primary); margin-bottom: 8px;">${escapeHtml(issue.summary)}</div>
        <div class="release-card-intro" style="font-size: 13px; line-height: 1.6; font-weight: 600; color: var(--on-surface);">${escapeHtml(releaseNote.intro)}</div>
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--on-surface-variant); margin-top: 8px; margin-bottom: 6px; letter-spacing: 0.05em;">${escapeHtml(headerText)}</div>
        <ul class="release-card-highlights">
          ${releaseNote.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}
        </ul>
        <div class="release-card-benefit" style="margin-top: 10px;">${escapeHtml(releaseNote.benefit)}</div>
      `;
      
      const copyBtn = card.querySelector('.release-copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(fullPlainText).then(() => {
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">check</span><span>Copied!</span>`;
            setTimeout(() => {
              copyBtn.classList.remove('copied');
              copyBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">content_copy</span><span>Copy</span>`;
            }, 2000);
          }).catch(err => console.error('Copy failed: ', err));
        });
      }
      
      variationsList.appendChild(card);
      if (emptyState) emptyState.style.display = 'none';
      if (resultsContainer) resultsContainer.style.display = 'block';
    }
  }

  // ==========================================
  // 2. JSON TRIMMER UTILITY VIEW
  // ==========================================
  function initTrimmerView() {
    const btnTabFetch = document.getElementById('btn-trimmer-tab-fetch');
    const btnTabPaste = document.getElementById('btn-trimmer-tab-paste');
    const tabFetchContent = document.getElementById('trimmer-tab-fetch-content');
    const tabPasteContent = document.getElementById('trimmer-tab-paste-content');

    const inputKey = document.getElementById('trimmer-issue-key');
    const btnFetchTrim = document.getElementById('btn-trimmer-fetch-generate');

    const textareaJson = document.getElementById('trimmer-raw-json');
    const btnPasteTrim = document.getElementById('btn-trimmer-paste-generate');

    const statusContainer = document.getElementById('trimmer-status-container');
    const statusText = document.getElementById('trimmer-status-text');
    const errorBanner = document.getElementById('trimmer-error-banner');
    const errorMessage = document.getElementById('trimmer-error-message');

    const jsonDisplay = document.getElementById('trimmer-json-display');
    const btnCopyOutput = document.getElementById('btn-trimmer-copy-output');
    const btnDownloadOutput = document.getElementById('btn-trimmer-download-output');

    let currentTrimmedData = null;

    if (inputKey) {
      inputKey.addEventListener('blur', () => {
        let val = inputKey.value.trim().toUpperCase();
        if (/^\d+$/.test(val)) inputKey.value = 'FMS-' + val;
      });
    }

    if (btnTabFetch && btnTabPaste) {
      btnTabFetch.addEventListener('click', () => {
        btnTabFetch.classList.add('active');
        btnTabPaste.classList.remove('active');
        if (tabFetchContent) tabFetchContent.style.display = 'block';
        if (tabPasteContent) tabPasteContent.style.display = 'none';
        hideError();
      });

      btnTabPaste.addEventListener('click', () => {
        btnTabPaste.classList.add('active');
        btnTabFetch.classList.remove('active');
        if (tabPasteContent) tabPasteContent.style.display = 'block';
        if (tabFetchContent) tabFetchContent.style.display = 'none';
        hideError();
      });
    }

    if (btnFetchTrim) {
      btnFetchTrim.addEventListener('click', async () => {
        hideError();
        let key = inputKey.value.trim().toUpperCase();
        if (!key) {
          showError('Please enter a valid Jira issue key (e.g. 101 or FMS-101).');
          return;
        }

        if (/^\d+$/.test(key)) {
          key = 'FMS-' + key;
          inputKey.value = key;
        }

        showLoading('Processing sample ticket payload...');
        await new Promise(r => setTimeout(r, 300));
        const demoIssue = getSampleDemoTicket(key);
        processAndDisplay(demoIssue);
        hideLoading();
      });
    }

    if (btnPasteTrim) {
      btnPasteTrim.addEventListener('click', () => {
        hideError();
        const jsonText = textareaJson.value.trim();
        if (!jsonText) {
          showError('Please paste a Jira ticket JSON payload.');
          return;
        }

        try {
          const parsed = JSON.parse(jsonText);
          processAndDisplay(parsed);
        } catch (err) {
          showError(`Failed to parse JSON: ${err.message}`);
        }
      });
    }

    if (btnCopyOutput) {
      btnCopyOutput.addEventListener('click', () => {
        if (!currentTrimmedData) return;
        const text = JSON.stringify(currentTrimmedData, null, 2);
        navigator.clipboard.writeText(text).then(() => {
          const span = btnCopyOutput.querySelector('span:not(.material-symbols-outlined)');
          const origText = span ? span.textContent : 'Copy';
          if (span) span.textContent = 'Copied!';
          btnCopyOutput.style.borderColor = 'var(--done-border)';
          btnCopyOutput.style.color = 'var(--done-color)';
          setTimeout(() => {
            if (span) span.textContent = origText;
            btnCopyOutput.style.borderColor = 'var(--outline)';
            btnCopyOutput.style.color = 'var(--on-surface)';
          }, 2000);
        }).catch(err => console.error('Clipboard copy failed:', err));
      });
    }

    if (btnDownloadOutput) {
      btnDownloadOutput.addEventListener('click', () => {
        if (!currentTrimmedData) return;
        const text = JSON.stringify(currentTrimmedData, null, 2);
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = (currentTrimmedData.key ? currentTrimmedData.key : 'trimmed') + '-data.json';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    }

    function processAndDisplay(parsedPayload) {
      let issueObj = parsedPayload;
      if (Array.isArray(parsedPayload)) {
        issueObj = parsedPayload[0] || {};
      } else if (parsedPayload.issues && Array.isArray(parsedPayload.issues)) {
        issueObj = parsedPayload.issues[0] || {};
      } else if (parsedPayload.issue) {
        issueObj = parsedPayload.issue;
      }

      const key = issueObj.key || (issueObj.fields && issueObj.fields.key) || '';
      const rawSummary = issueObj.fields?.summary || issueObj.summary || '';
      const rawDescription = issueObj.fields?.description || issueObj.description || '';

      if (!rawSummary && !rawDescription) {
        showError('Could not locate heading (summary) or description in the payload.');
        return;
      }

      const cleanHeading = typeof rawSummary === 'object' && typeof adfToMarkdown === 'function'
        ? adfToMarkdown(rawSummary)
        : String(rawSummary);

      const cleanDescription = typeof rawDescription === 'object' && typeof adfToMarkdown === 'function'
        ? adfToMarkdown(rawDescription)
        : String(rawDescription);

      const trimmed = {
        heading: cleanHeading.trim(),
        description: cleanDescription.trim()
      };

      if (key) trimmed.key = key;

      currentTrimmedData = trimmed;
      if (jsonDisplay) jsonDisplay.textContent = JSON.stringify(trimmed, null, 2);
    }

    function showLoading(msg) {
      if (statusText) statusText.textContent = msg;
      if (statusContainer) statusContainer.style.display = 'block';
    }

    function hideLoading() {
      if (statusContainer) statusContainer.style.display = 'none';
    }

    function showError(msg) {
      if (errorMessage) errorMessage.textContent = msg;
      if (errorBanner) errorBanner.style.display = 'flex';
    }

    function hideError() {
      if (errorBanner) errorBanner.style.display = 'none';
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
