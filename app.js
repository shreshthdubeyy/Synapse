/**
 * Jira Epic Hierarchy Analyzer - Core Application Controller
 */

(function () {
  // --- CONFIGURATION ---
  // --- CONFIGURATION ---
  // Demo Mode only - Live API disabled

  // --- APPLICATION STATE ---
  let appState = {
    epic: null,
    issues: [],
    filteredIssues: [],
    activeIssue: null,
    filterType: 'All',
    searchQuery: '',
    activeTab: 'overview',
    keyboardIndex: -1,
    
    // Graph Engine variables
    activeView: 'workspace',
    zoomLevel: 1.0,
    graphLayout: 'vert',
    showGraphSubtasks: true,
    collapsedNodes: new Set()
  };


  // --- DOM ELEMENT CACHE ---
  const el = {
    appContainer: document.getElementById('app-container'),
    leftPanel: document.getElementById('left-panel'),
    rightPanel: document.getElementById('right-panel'),
    resizeHandleLeft: document.getElementById('resize-handle-left'),
    resizeHandleRight: document.getElementById('resize-handle-right'),
    
    // Epic Header
    epicTitle: document.getElementById('epic-title'),
    epicStatusBadge: document.getElementById('epic-status-badge'),
    epicProgressBar: document.getElementById('epic-progress-bar'),
    epicIssuesTotal: document.getElementById('epic-issues-total'),
    epicIssuesDone: document.getElementById('epic-issues-done'),
    epicIssuesOpen: document.getElementById('epic-issues-open'),
    
    // Filters & Navigation
    breadcrumbsBar: document.getElementById('breadcrumbs-bar'),
    typeFilterPills: document.getElementById('type-filter-pills'),
    searchBar: document.getElementById('search-bar'),
    ticketList: document.getElementById('ticket-list'),
    
    // Workspace Center
    issueKeyDisplay: document.getElementById('issue-key-display'),
    issueTypeBadgeContainer: document.getElementById('issue-type-badge-container'),
    issueTitleDisplay: document.getElementById('issue-title-display'),
    
    // Metadata Workspace
    metaStatus: document.getElementById('meta-status'),
    metaPriority: document.getElementById('meta-priority'),
    metaAssignee: document.getElementById('meta-assignee'),
    metaSprint: document.getElementById('meta-sprint'),
    metaPoints: document.getElementById('meta-points'),
    metaUpdated: document.getElementById('meta-updated'),
    metaReporter: document.getElementById('meta-reporter'),
    
    // Workspace Tabs & Content
    tabsBar: document.getElementById('workspace-tabs-bar'),
    tabContentArea: document.getElementById('workspace-content-area'),
    commentsCountBadge: document.getElementById('comments-count-badge'),
    linksCountBadge: document.getElementById('links-count-badge'),
    
    // Sidebar Context
    sidebarParentContext: document.getElementById('sidebar-parent-context'),
    sidebarChildContext: document.getElementById('sidebar-child-context'),
    aiAnalysisContent: document.getElementById('ai-analysis-content'),
    
    // Metrics Widgets
    metricCompletion: document.getElementById('metric-completion'),
    metricOpen: document.getElementById('metric-open'),
    metricBlocked: document.getElementById('metric-blocked'),
    metricHighest: document.getElementById('metric-highest'),
    
    // Modals & Connections
    btnImportJson: document.getElementById('btn-import-json'),
    modalImportJson: document.getElementById('modal-import-json-overlay'),
    
    // Modal Close Triggers
    btnCloseImportModal: document.getElementById('btn-close-import-modal'),
    btnCloseImportFooter: document.getElementById('btn-close-import-footer'),
    
    // Modal Forms
    jsonFileInput: document.getElementById('json-file-input'),
    jsonTextInput: document.getElementById('json-text-input'),
    btnSubmitImport: document.getElementById('btn-submit-import'),
    
    // Errors & Terminal helpers
    importErrorBanner: document.getElementById('import-error-banner'),
    importErrorMessage: document.getElementById('import-error-message'),

    // Live Switcher & Gemini AI Key configuration
    epicSwitcherInput: document.getElementById('epic-switcher-input'),
    btnEpicSwitcherLoad: document.getElementById('btn-epic-switcher-load'),


    // View switcher header links and panels
    navWorkspaceLink: document.getElementById('nav-workspace-link'),
    navGraphLink: document.getElementById('nav-graph-link'),
    workspaceView: document.getElementById('workspace-view'),
    dependencyGraphView: document.getElementById('dependency-graph-view'),

    // Dependency Graph Canvas Elements
    graphViewportCanvas: document.getElementById('graph-viewport-canvas'),
    graphNodesWrapper: document.getElementById('graph-nodes-wrapper'),
    graphSvgConnections: document.getElementById('graph-svg-connections'),
    zoomValueLabel: document.getElementById('zoom-value-label'),
    btnZoomIn: document.getElementById('btn-zoom-in'),
    btnZoomOut: document.getElementById('btn-zoom-out'),
    btnZoomFit: document.getElementById('btn-zoom-fit'),
    btnLayoutHorz: document.getElementById('btn-layout-horz'),
    btnLayoutVert: document.getElementById('btn-layout-vert'),
    btnToggleSubtasks: document.getElementById('btn-toggle-subtasks'),
    graphEpicKey: document.getElementById('graph-epic-key'),

    // Dependency Graph Sidebar Elements
    graphTotalNodes: document.getElementById('graph-total-nodes'),
    graphCriticalPath: document.getElementById('graph-critical-path'),
    graphBlockedCount: document.getElementById('graph-blocked-count'),
    graphBottlenecksList: document.getElementById('graph-bottlenecks-list'),
    graphRiskPaths: document.getElementById('graph-risk-paths')
  };

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initResizablePanels();
    initEventListeners();
    
    // Show animated constellation loader on initial page open
    showLoader('Initializing Synapse workspace...', 'synapse');
    setTimeout(() => {
      updateLoaderStatus('Configuring interactive panels...');
    }, 600);
    setTimeout(() => {
      updateLoaderStatus('Ready.');
    }, 1200);
    setTimeout(() => {
      hideLoader();
      loadDefaultData();

      // Auto-switch view based on URL hash
      const hash = window.location.hash;
      if (hash === '#graph' && el.navGraphLink) {
        el.navGraphLink.click();
      } else if (hash === '#release' && el.navReleaseLink) {
        el.navReleaseLink.click();
      }
    }, 1600);
  });

  // --- PANEL RESIZING LOGIC ---
  let resizeAnimationFrameId = null;
  let pendingLeft = null;
  let pendingRight = null;

  function updatePanelColumnsThrottled(left, right) {
    pendingLeft = left;
    pendingRight = right;
    if (!resizeAnimationFrameId) {
      resizeAnimationFrameId = requestAnimationFrame(() => {
        el.appContainer.style.gridTemplateColumns = `${pendingLeft}px 4px 1fr 4px ${pendingRight}px`;
        resizeAnimationFrameId = null;
      });
    }
  }

  function initResizablePanels() {
    let isResizingLeft = false;
    let isResizingRight = false;

    // Load widths from localStorage or defaults
    const leftWidth = localStorage.getItem('panel-width-left') || '320';
    const rightWidth = localStorage.getItem('panel-width-right') || '360';
    
    updatePanelColumns(leftWidth, rightWidth);

    el.resizeHandleLeft.addEventListener('mousedown', (e) => {
      isResizingLeft = true;
      el.resizeHandleLeft.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    el.resizeHandleRight.addEventListener('mousedown', (e) => {
      isResizingRight = true;
      el.resizeHandleRight.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    el.resizeHandleLeft.addEventListener('dblclick', () => {
      localStorage.removeItem('panel-width-left');
      const currentRight = parseFloat(localStorage.getItem('panel-width-right') || '360');
      updatePanelColumns(320, currentRight);
    });

    el.resizeHandleRight.addEventListener('dblclick', () => {
      localStorage.removeItem('panel-width-right');
      const currentLeft = parseFloat(localStorage.getItem('panel-width-left') || '320');
      updatePanelColumns(currentLeft, 360);
    });

    window.addEventListener('mousemove', (e) => {
      if (isResizingLeft) {
        const left = Math.max(220, Math.min(e.clientX, 600)); // Constraint: 220px to 600px
        const currentRight = parseFloat(localStorage.getItem('panel-width-right') || rightWidth);
        updatePanelColumnsThrottled(left, currentRight);
      } else if (isResizingRight) {
        const right = Math.max(260, Math.min(window.innerWidth - e.clientX, 600)); // Constraint: 260px to 600px
        const currentLeft = parseFloat(localStorage.getItem('panel-width-left') || leftWidth);
        updatePanelColumnsThrottled(currentLeft, right);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isResizingLeft) {
        isResizingLeft = false;
        el.resizeHandleLeft.classList.remove('active');
        savePanelWidths();
      }
      if (isResizingRight) {
        isResizingRight = false;
        el.resizeHandleRight.classList.remove('active');
        savePanelWidths();
      }
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    });
  }

  function updatePanelColumns(left, right) {
    el.appContainer.style.gridTemplateColumns = `${left}px 4px 1fr 4px ${right}px`;
  }

  function savePanelWidths() {
    const columns = getComputedStyle(el.appContainer).gridTemplateColumns.split(' ');
    // grid: left, handle, center, handle, right
    const leftWidth = parseFloat(columns[0]);
    const rightWidth = parseFloat(columns[4]);
    localStorage.setItem('panel-width-left', leftWidth);
    localStorage.setItem('panel-width-right', rightWidth);
  }

  // --- DATA LOADING & INTERFACE BINDING ---
  function loadDefaultData() {
    renderEmptyState();
  }

  function updateWorkspaceDataset(epic, issues) {
    appState.epic = epic;
    appState.issues = issues;
    appState.activeIssue = epic; // Default to Epic root on start
    appState.filterType = 'All';
    appState.searchQuery = '';
    appState.keyboardIndex = -1;



    updateEpicHeader();
    applyFilterAndSearch();
    renderWorkspace();
    renderInsights();

    // Redraw graph if in graph view
    if (appState.activeView === 'graph') {
      renderDependencyGraph();
    }
  }

  // --- EPIC SUMMARY AND PROGRESS ---
  function updateEpicHeader() {
    el.epicTitle.textContent = appState.epic.summary;
    el.epicStatusBadge.textContent = appState.epic.status;
    
    // Status color mapping
    el.epicStatusBadge.className = 'badge';
    el.epicStatusBadge.classList.add(getStatusBadgeClass(appState.epic.status));

    // Calculate progress
    const total = appState.issues.length;
    const completed = appState.issues.filter(i => isStatusDone(i.status)).length;
    const open = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    el.epicProgressBar.style.width = `${percentage}%`;
    el.epicIssuesTotal.textContent = `${total} Issues`;
    el.epicIssuesDone.textContent = completed;
    el.epicIssuesOpen.textContent = open;

    // Render numbers on filter pills
    document.getElementById('count-story').textContent = appState.issues.filter(i => i.type === 'Story').length;
    document.getElementById('count-task').textContent = appState.issues.filter(i => i.type === 'Task').length;
    document.getElementById('count-bug').textContent = appState.issues.filter(i => i.type === 'Bug').length;
    document.getElementById('count-improvement').textContent = appState.issues.filter(i => i.type === 'Improvement').length;
    document.getElementById('count-subtask').textContent = appState.issues.filter(i => i.type === 'Subtask').length;
  }

  // --- FILTER & SEARCH APPLICATION ---
  function applyFilterAndSearch() {
    // Exclude subtasks from the main left navigator list
    let list = [appState.epic, ...appState.issues].filter(i => i !== null && i.key && i.type !== 'Subtask');

    // 1. Issue type filter
    if (appState.filterType !== 'All') {
      list = list.filter(i => i.type === appState.filterType);
    }

    // 2. Search query filter
    if (appState.searchQuery.trim().length > 0) {
      const q = appState.searchQuery.toLowerCase();
      list = list.filter(i => 
        i.key.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        (i.assignee && i.assignee.name.toLowerCase().includes(q))
      );
    }

    // Sort: Epic always at the top, then project prefix alphabetically, then ticket number numerically
    list.sort((a, b) => {
      // Force Epic root to the absolute top
      if (appState.epic) {
        if (a.key === appState.epic.key) return -1;
        if (b.key === appState.epic.key) return 1;
      }

      const regex = /^([A-Z0-9]+)-([0-9]+)$/i;
      const matchA = String(a.key).match(regex);
      const matchB = String(b.key).match(regex);

      if (matchA && matchB) {
        const projA = matchA[1].toUpperCase();
        const projB = matchB[1].toUpperCase();
        if (projA !== projB) {
          return projA.localeCompare(projB);
        }
        return parseInt(matchA[2], 10) - parseInt(matchB[2], 10);
      } else if (matchA) {
        return -1;
      } else if (matchB) {
        return 1;
      } else {
        const numA = parseInt(a.key, 10);
        const numB = parseInt(b.key, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return String(a.key).localeCompare(String(b.key));
      }
    });

    appState.filteredIssues = list;
    
    // Check if the query is a Jira key, not present locally, to offer Live Search fallback
    appState.jiraSearchKey = null;

    appState.keyboardIndex = -1; // Reset keyboard nav focus
    renderTicketNavigatorList();
  }

  // --- RENDER TICKET NAVIGATOR (LEFT PANEL LIST) ---
  function renderTicketNavigatorList() {
    el.ticketList.innerHTML = '';
    
    if (appState.filteredIssues.length === 0 && !appState.jiraSearchKey) {
      el.ticketList.innerHTML = `
        <li style="padding: 24px; text-align: center; color: var(--text-muted);">
          No matching issues found
        </li>
      `;
      return;
    }

    appState.filteredIssues.forEach((issue, index) => {
      const li = document.createElement('li');
      li.className = 'ticket-row';
      if (appState.activeIssue && appState.activeIssue.key === issue.key) {
        li.classList.add('active');
        appState.keyboardIndex = index; // Synchronize index
      }

      const typeBadgeClass = issue.type.toLowerCase();
      const iconImg = issue.iconUrl 
        ? `<img src="${issue.iconUrl}" alt="" style="width: 12px; height: 12px; object-fit: contain; margin-right: 4px; vertical-align: middle;" onerror="this.remove();">` 
        : '';

      const initials = issue.assignee ? issue.assignee.avatar : 'UN';
      const avatarImgHtml = issue.assignee && issue.assignee.avatarUrl
        ? `<img src="${issue.assignee.avatarUrl}" alt="" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.remove();">`
        : '';

      li.innerHTML = `
        <div class="ticket-left">
          <span class="ticket-key">${issue.key}</span>
          <span class="ticket-summary">${issue.summary}</span>
        </div>
        <div class="ticket-right">
          <span class="type-badge ${typeBadgeClass}" style="display: inline-flex; align-items: center; justify-content: center; height: 20px;">
            ${iconImg}
            <span>${issue.type}</span>
          </span>
          <span class="badge ${getStatusBadgeClass(issue.status)}">${issue.status}</span>
          <div class="avatar-circle" title="Assignee: ${issue.assignee ? issue.assignee.name : 'Unassigned'}" style="position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            <span>${initials}</span>
            ${avatarImgHtml}
          </div>
        </div>
      `;

      li.addEventListener('click', () => {
        selectIssue(issue);
      });

      el.ticketList.appendChild(li);
    });

    // Append Live JQL Connected Search row
  }

  function selectIssue(issue) {
    appState.activeIssue = issue;
    
    // Update active highlight classes in Left Panel without full reload
    const rows = el.ticketList.querySelectorAll('.ticket-row');
    rows.forEach((row, index) => {
      const keySpan = row.querySelector('.ticket-key');
      if (keySpan && keySpan.textContent === issue.key) {
        row.classList.add('active');
        appState.keyboardIndex = index;
      } else {
        row.classList.remove('active');
      }
    });

    renderWorkspace();
    renderInsights();

    // Update active node highlight in the dependency graph
    if (appState.activeView === 'graph') {
      const nodes = el.graphNodesWrapper.querySelectorAll('.graph-node');
      nodes.forEach(n => {
        if (n.dataset.key === issue.key) {
          n.classList.add('active');
        } else {
          n.classList.remove('active');
        }
      });
      renderGraphSidebar();
    }
  }

  // --- RENDER WORKSPACE DETAILS (CENTER PANEL) ---
  function renderWorkspace() {
    const issue = appState.activeIssue;
    if (!issue) {
      el.issueTitleDisplay.textContent = 'Select an issue to inspect details';
      el.issueKeyDisplay.textContent = '';
      el.issueTypeBadgeContainer.innerHTML = '';
      return;
    }

    // Header Meta
    el.issueKeyDisplay.textContent = issue.key;
    
    const iconImg = issue.iconUrl 
      ? `<img src="${issue.iconUrl}" alt="" style="width: 12px; height: 12px; object-fit: contain; margin-right: 4px; vertical-align: middle;" onerror="this.remove();">` 
      : '';
    el.issueTypeBadgeContainer.innerHTML = `<span class="type-badge ${issue.type.toLowerCase()}" style="display: inline-flex; align-items: center; justify-content: center; height: 20px;">${iconImg}<span>${issue.type}</span></span>`;
    el.issueTitleDisplay.textContent = issue.summary;

    // Metadata Row Chips
    el.metaStatus.innerHTML = `<span class="badge ${getStatusBadgeClass(issue.status)}">${issue.status}</span>`;
    el.metaPriority.innerHTML = `
      <span class="priority-icon priority-${issue.priority.toLowerCase()}">✦</span>
      <span class="meta-value">${issue.priority}</span>
    `;

    if (issue.assignee) {
      const initials = issue.assignee.avatar;
      const avatarHtml = `
        <span class="avatar-circle" style="width: 14px; height: 14px; font-size: 7px; position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; margin-right: 6px; vertical-align: middle;">
          <span>${initials}</span>
          ${issue.assignee.avatarUrl ? `<img src="${issue.assignee.avatarUrl}" alt="" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.remove();">` : ''}
        </span>
      `;
      el.metaAssignee.innerHTML = `<div style="display: inline-flex; align-items: center;">${avatarHtml}<span>${issue.assignee.name}</span></div>`;
    } else {
      el.metaAssignee.textContent = 'Unassigned';
    }
    el.metaSprint.textContent = issue.sprint || 'Backlog';
    el.metaPoints.textContent = issue.storyPoints !== null ? issue.storyPoints : '--';
    el.metaReporter.textContent = issue.reporter || 'Anonymous';
    
    // Normalize date format
    const updateDate = new Date(issue.updated || issue.created);
    el.metaUpdated.textContent = updateDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Tab numbers counts
    el.commentsCountBadge.textContent = issue.comments.length > 0 ? `(${issue.comments.length})` : '';
    el.linksCountBadge.textContent = issue.linkedIssues.length > 0 ? `(${issue.linkedIssues.length})` : '';

    // Render Tab Panels
    renderActiveTabContent();
    renderBreadcrumbs();
  }

  function renderBreadcrumbs() {
    el.breadcrumbsBar.innerHTML = '';
    const issue = appState.activeIssue;
    if (!issue) return;

    const rootEpic = appState.epic;
    
    // Build Breadcrumb List: Epic [>] (Parent Story if Subtask) [>] Current Issue
    const crumbs = [];

    // 1. Epic Root link
    crumbs.push({ key: rootEpic.key, label: rootEpic.summary, issue: rootEpic });

    // 2. Parent Story if current is subtask
    if (issue.type === 'Subtask' && issue.parentKey) {
      const parent = appState.issues.find(i => i.key === issue.parentKey);
      if (parent) {
        crumbs.push({ key: parent.key, label: parent.summary, issue: parent });
      }
    }

    // 3. Current Issue (Active)
    if (issue.key !== rootEpic.key) {
      crumbs.push({ key: issue.key, label: issue.summary, issue: issue, active: true });
    } else {
      crumbs[0].active = true;
    }

    // Append to DOM
    crumbs.forEach((c, idx) => {
      if (idx > 0) {
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = '>';
        el.breadcrumbsBar.appendChild(separator);
      }

      const span = document.createElement('span');
      span.className = 'breadcrumb-item';
      if (c.active) {
        span.classList.add('breadcrumb-active');
        span.textContent = c.key;
      } else {
        span.textContent = c.key;
        span.addEventListener('click', () => selectIssue(c.issue));
      }
      span.title = c.label;
      el.breadcrumbsBar.appendChild(span);
    });
  }

  function renderActiveTabContent() {
    const issue = appState.activeIssue;
    if (!issue) return;

    // Hide empty state panel
    const emptyStatePanel = document.getElementById('tab-empty-state');
    if (emptyStatePanel) emptyStatePanel.classList.remove('active');

    // Show tabs bar
    if (el.tabsBar) el.tabsBar.style.display = 'flex';

    // Reset panel view classes
    const tabs = el.tabsBar.querySelectorAll('.tab-btn');
    tabs.forEach(t => {
      const panelId = `tab-${t.dataset.tab}`;
      const panel = document.getElementById(panelId);
      if (t.dataset.tab === appState.activeTab) {
        t.classList.add('active');
        if (panel) panel.classList.add('active');
      } else {
        t.classList.remove('active');
        if (panel) panel.classList.remove('active');
      }
    });

    // Overview Tab Loading
    if (appState.activeTab === 'overview') {
      const descContent = document.getElementById('desc-content');
      if (descContent) {
        descContent.innerHTML = parseMarkdownToHTML(issue.description || '*No description provided.*');
      }
      
      const acList = document.getElementById('ac-content');
      if (acList) {
        acList.innerHTML = '';
        const acs = issue.acceptanceCriteria;
        if (acs) {
          if (typeof acs === 'string') {
            acList.innerHTML = parseMarkdownToHTML(acs);
          } else if (Array.isArray(acs) && acs.length > 0) {
            const formattedItems = acs.map(item => {
              const trimmed = item.trim();
              if (trimmed.startsWith('-') || trimmed.startsWith('*') || /^\d+\./.test(trimmed) || trimmed.startsWith('|')) {
                return item;
              }
              return '- ' + item;
            });
            acList.innerHTML = parseMarkdownToHTML(formattedItems.join('\n'));
          } else {
            acList.innerHTML = `<p style="opacity:0.5; font-style:italic; margin: 0;">No custom acceptance criteria specified.</p>`;
          }
        } else {
          acList.innerHTML = `<p style="opacity:0.5; font-style:italic; margin: 0;">No custom acceptance criteria specified.</p>`;
        }
      }
    }
    
    // Comments Tab Loading
    else if (appState.activeTab === 'comments') {
      const container = document.getElementById('comments-list-container');
      if (container) {
        container.innerHTML = '';
        if (issue.comments && issue.comments.length > 0) {
          issue.comments.forEach(c => {
            const card = document.createElement('div');
            card.className = 'comment-card';
            
            const dateStr = new Date(c.created).toLocaleString();
            const initials = c.author.substring(0, 2).toUpperCase();
            const avatarHtml = `
              <div class="avatar-circle" style="width: 16px; height: 16px; font-size: 8px; position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle;">
                <span>${initials}</span>
                ${c.avatar ? `<img src="${c.avatar}" alt="" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.remove();">` : ''}
              </div>
            `;

            card.innerHTML = `
              <div class="comment-header">
                <div class="comment-author" style="display: flex; align-items: center; gap: 6px;">
                  ${avatarHtml}
                  <span>${c.author}</span>
                </div>
                <span class="comment-date">${dateStr}</span>
              </div>
              <div class="doc-text" style="font-size:13px;">${parseMarkdownToHTML(c.content)}</div>
            `;
            container.appendChild(card);
          });
        } else {
          container.innerHTML = `
            <div class="empty-placeholder">
              <span class="empty-placeholder-title">No comments</span>
              <p class="empty-placeholder-desc">No discussions have been recorded on this ticket yet.</p>
            </div>
          `;
        }
      }
    }
    
    // Links Tab Loading
    else if (appState.activeTab === 'links') {
      const container = document.getElementById('linked-issues-container');
      if (container) {
        container.innerHTML = '';
        if (issue.linkedIssues && issue.linkedIssues.length > 0) {
          issue.linkedIssues.forEach(l => {
            const item = document.createElement('div');
            item.className = 'context-item';
            
            item.innerHTML = `
              <div class="context-item-left">
                <span class="context-item-key">${l.key}</span>
                <span class="type-badge ${l.type.toLowerCase()}" style="font-size:9px;">${l.type}</span>
                <span class="context-item-summary">${l.summary}</span>
              </div>
              <span class="badge ${getStatusBadgeClass(l.status)}">${l.status}</span>
            `;
            
            // Cross link navigation
            item.addEventListener('click', () => {
              const target = appState.issues.find(i => i.key === l.key) || (appState.epic.key === l.key ? appState.epic : null);
              if (target) selectIssue(target);
            });
            
            container.appendChild(item);
          });
        } else {
          container.innerHTML = `
            <div class="empty-placeholder">
              <span class="empty-placeholder-title">No dependencies</span>
              <p class="empty-placeholder-desc">No external links or blocks configured for this issue.</p>
            </div>
          `;
        }
      }
    }
    
    // Attachments Tab
    else if (appState.activeTab === 'attachments') {
      const container = document.getElementById('attachments-list-container');
      if (container) {
        container.innerHTML = '';
        const attachments = issue.attachments || [];

        if (attachments.length === 0) {
          container.innerHTML = `
            <div class="empty-placeholder" style="height: 160px;">
              <span class="material-symbols-outlined" style="font-size: 36px; color: var(--outline); opacity: 0.5;">attach_file</span>
              <div class="empty-placeholder-title" style="font-size: 13px; margin-top: 8px;">No attachments</div>
              <p class="empty-placeholder-desc" style="margin-top: 4px;">No files have been attached to this issue.</p>
            </div>
          `;
        } else {
          const typeIconMap = {
            pdf:  { icon: 'picture_as_pdf', color: '#dc2626' },
            png:  { icon: 'image',          color: '#0891b2' },
            jpg:  { icon: 'image',          color: '#0891b2' },
            jpeg: { icon: 'image',          color: '#0891b2' },
            json: { icon: 'data_object',    color: '#059669' },
            xlsx: { icon: 'table_chart',    color: '#059669' },
            csv:  { icon: 'table_chart',    color: '#059669' },
            docx: { icon: 'description',    color: '#2563eb' },
            doc:  { icon: 'description',    color: '#2563eb' },
            zip:  { icon: 'folder_zip',     color: '#d97706' },
          };

          attachments.forEach(att => {
            const ext = (att.filename || att.name || '').split('.').pop().toLowerCase();
            const typeInfo = typeIconMap[ext] || { icon: 'attach_file', color: 'var(--on-surface-variant)' };
            const displayName = att.filename || att.name || 'Unknown file';
            const displaySize = att.size ? (att.size > 1048576 ? (att.size / 1048576).toFixed(1) + ' MB' : Math.round(att.size / 1024) + ' KB') : '';
            const displayDate = att.created ? new Date(att.created).toLocaleDateString() : (att.date || '');
            const downloadUrl = att.contentUrl || att.content || null;
            const thumbnailUrl = att.thumbnailUrl || att.thumbnail || null;

            const item = document.createElement('div');
            item.className = 'context-item';
            item.style.cursor = downloadUrl ? 'pointer' : 'default';
            
            let previewHtml = '';
            const isImage = (att.mimeType && att.mimeType.startsWith('image/')) || ['png', 'jpg', 'jpeg', 'gif'].includes(ext);
            if (thumbnailUrl && isImage) {
              previewHtml = `<img src="${thumbnailUrl}" alt="${displayName}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--outline-variant);">`;
            } else {
              previewHtml = `<span class="material-symbols-outlined" style="font-size: 16px; color: ${typeInfo.color}; flex-shrink: 0;">${typeInfo.icon}</span>`;
            }

            item.innerHTML = `
              <div class="context-item-left" style="gap: 8px; align-items: center;">
                ${previewHtml}
                <div style="display: flex; flex-direction: column; min-width: 0;">
                  <span class="context-item-summary" style="font-weight: 500; font-size: 11px;">${displayName}</span>
                  ${displaySize ? `<span style="font-size: 9px; color: var(--on-surface-variant); margin-top: 1px; opacity: 0.7;">${displaySize}</span>` : ''}
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                ${displayDate ? `<span style="font-size: 10px; color: var(--on-surface-variant); opacity: 0.7;">${displayDate}</span>` : ''}
                ${downloadUrl ? `<span class="material-symbols-outlined" style="font-size: 12px; color: var(--primary); opacity: 0.8;">open_in_new</span>` : ''}
              </div>
            `;
            if (downloadUrl) {
              item.addEventListener('click', () => window.open(downloadUrl, '_blank'));
            }
            container.appendChild(item);
          });
        }
      }
    }
    
    // History Tab Loading
    else if (appState.activeTab === 'history') {
      const container = document.getElementById('history-timeline-container');
      if (container) {
        container.innerHTML = '';
        if (issue.history && issue.history.length > 0) {
          issue.history.forEach(h => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            const dateStr = new Date(h.date).toLocaleDateString();
            const avatarUrl = window.JiraParser.getUserAvatarUrl(h.author);
            const initials = h.author.substring(0, 2).toUpperCase();
            item.innerHTML = `
              <div class="history-avatar">
                <div class="avatar-circle" style="width: 18px; height: 18px; font-size: 8px; position: relative; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; vertical-align: middle;">
                  <span>${initials}</span>
                  ${avatarUrl ? `<img src="${avatarUrl}" alt="" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.remove();">` : ''}
                </div>
              </div>
              <div class="history-body">
                <div>
                  <span class="history-user">${h.author}</span>
                  <span class="history-action">changed field</span>
                  <strong style="color:var(--text-primary); font-size:12px;">${h.field}</strong>
                </div>
                <div class="history-change" style="margin-top:4px;">
                  <span style="color:var(--text-secondary); text-decoration: line-through;">${h.from}</span>
                  <span class="history-arrow">→</span>
                  <strong style="color:var(--text-primary);">${h.to}</strong>
                </div>
                <div class="history-date">${dateStr}</div>
              </div>
            `;
            container.appendChild(item);
          });
        } else {
          container.innerHTML = `<p style="font-style:italic; text-align:center; color:var(--text-muted); padding: 24px;">No change records exist.</p>`;
        }
      }
    }
  }

  // --- RENDER SIDEBAR CONTEXT (RIGHT PANEL) ---
  function renderInsights() {
    const issue = appState.activeIssue;
    if (!issue) return;

    // 1. Parent Context Rendering
    const parentContainer = el.sidebarParentContext;
    parentContainer.innerHTML = '';

    // Parent is either the root Epic (if issue is story/task) OR the Story (if issue is subtask)
    if (issue.type !== 'Epic') {
      // Add root Epic
      const epicItem = document.createElement('div');
      epicItem.className = 'context-item';
      epicItem.innerHTML = `
        <div class="context-item-left">
          <span class="material-symbols-outlined" style="font-size: 13px; color: var(--primary); margin-right: 4px;">key</span>
          <span class="context-item-key">${appState.epic.key}</span>
          <span class="context-item-summary" style="font-weight:600;">[Epic] ${appState.epic.summary}</span>
        </div>
      `;
      epicItem.addEventListener('click', () => selectIssue(appState.epic));
      parentContainer.appendChild(epicItem);

      // If subtask, also append direct Story parent
      if (issue.type === 'Subtask' && issue.parentKey) {
        const parent = appState.issues.find(i => i.key === issue.parentKey);
        if (parent) {
          const parentItem = document.createElement('div');
          parentItem.className = 'context-item';
          parentItem.innerHTML = `
            <div class="context-item-left">
              <span class="context-item-key">${parent.key}</span>
              <span class="context-item-summary">${parent.summary}</span>
            </div>
            <span class="badge ${getStatusBadgeClass(parent.status)}">${parent.status}</span>
          `;
          parentItem.addEventListener('click', () => selectIssue(parent));
          parentContainer.appendChild(parentItem);
        }
      }
    } else {
      parentContainer.innerHTML = `<p style="font-style:italic; font-size:11px; color:var(--text-secondary);">Root Epic has no parents.</p>`;
    }

    // 2. Child Context Rendering
    const childContainer = el.sidebarChildContext;
    childContainer.innerHTML = '';
    
    // Find children:
    // If Epic: children are all Stories, Tasks, Bugs, Improvements directly under Epic
    // If Story: children are its Subtasks
    // If Subtask: none
    let children = [];
    if (issue.type === 'Epic') {
      children = appState.issues.filter(i => i.type !== 'Subtask');
    } else if (issue.subtasks && issue.subtasks.length > 0) {
      children = appState.issues.filter(i => issue.subtasks.includes(i.key));
    }

    if (children.length > 0) {
      children.forEach(c => {
        const childItem = document.createElement('div');
        childItem.className = 'context-item';
        childItem.innerHTML = `
          <div class="context-item-left">
            <span class="context-item-key">${c.key}</span>
            <span class="type-badge ${c.type.toLowerCase()}" style="font-size:9px;">${c.type}</span>
            <span class="context-item-summary">${c.summary}</span>
          </div>
          <span class="badge ${getStatusBadgeClass(c.status)}">${c.status}</span>
        `;
        childItem.addEventListener('click', () => selectIssue(c));
        childContainer.appendChild(childItem);
      });
    } else {
      childContainer.innerHTML = `<p style="font-style:italic; font-size:11px; color:var(--text-secondary);">No children or subtasks defined.</p>`;
    }

    // 3. AI Analysis Rendering — only fetch on explicit user action
    const aiContainer = el.aiAnalysisContent;
    aiContainer.innerHTML = '';

    if (issue.aiAnalysisLive) {
      renderAIContent(aiContainer, issue.aiAnalysisLive, true);
    } else {
      renderAICTA(aiContainer, issue);
    }

    // 4. Metrics Widget Calculations
    const all = appState.issues;
    const total = all.length;
    const completed = all.filter(i => isStatusDone(i.status)).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const open = total - completed;
    
    const blocked = all.filter(i => i.status === 'Blocked' || i.linkedIssues.some(l => l.relation === 'is blocked by' && !isStatusDone(l.status))).length;
    const highest = all.filter(i => i.priority === 'Highest' && !isStatusDone(i.status)).length;

    el.metricCompletion.textContent = `${percentage}%`;
    el.metricOpen.textContent = open;
    el.metricBlocked.textContent = blocked;
    el.metricHighest.textContent = highest;
  }

  // --- EVENT LISTENERS BINDING ---
  function initEventListeners() {
    // View switching tabs
    el.navWorkspaceLink.addEventListener('click', (e) => {
      e.preventDefault();
      appState.activeView = 'workspace';
      el.navWorkspaceLink.classList.add('active');
      el.navGraphLink.classList.remove('active');
      el.workspaceView.classList.add('active');
      el.dependencyGraphView.classList.remove('active');
    });

    el.navGraphLink.addEventListener('click', (e) => {
      e.preventDefault();
      appState.activeView = 'graph';
      el.navWorkspaceLink.classList.remove('active');
      el.navGraphLink.classList.add('active');
      el.workspaceView.classList.remove('active');
      el.dependencyGraphView.classList.add('active');
      renderDependencyGraph();
    });

    // Zoom controls
    el.btnZoomIn.addEventListener('click', () => {
      appState.zoomLevel = Math.min(2.0, appState.zoomLevel + 0.1);
      applyZoom();
    });

    el.btnZoomOut.addEventListener('click', () => {
      appState.zoomLevel = Math.max(0.5, appState.zoomLevel - 0.1);
      applyZoom();
    });

    el.btnZoomFit.addEventListener('click', () => {
      appState.zoomLevel = 1.0;
      applyZoom();
      centerGraphViewport();
    });

    // Layout configuration toggles
    el.btnLayoutHorz.addEventListener('click', () => {
      appState.graphLayout = 'horz';
      el.btnLayoutHorz.classList.add('active');
      el.btnLayoutVert.classList.remove('active');
      renderDependencyGraph();
    });

    el.btnLayoutVert.addEventListener('click', () => {
      appState.graphLayout = 'vert';
      el.btnLayoutHorz.classList.remove('active');
      el.btnLayoutVert.classList.add('active');
      renderDependencyGraph();
    });

    el.btnToggleSubtasks.addEventListener('click', () => {
      appState.showGraphSubtasks = !appState.showGraphSubtasks;
      if (appState.showGraphSubtasks) {
        el.btnToggleSubtasks.classList.add('active');
      } else {
        el.btnToggleSubtasks.classList.remove('active');
      }
      renderDependencyGraph();
    });

    // Viewport drag-to-pan dragging
    let isPanning = false;
    let startX, startY;
    let scrollLeft, scrollTop;

    el.graphViewportCanvas.addEventListener('mousedown', (e) => {
      // Only pan on left click or middle click
      if (e.button !== 0 && e.button !== 1) return;
      if (e.target.closest('.graph-node')) return; // ignore dragging when clicking node card

      isPanning = true;
      el.graphViewportCanvas.style.cursor = 'grabbing';
      startX = e.pageX - el.graphViewportCanvas.offsetLeft;
      startY = e.pageY - el.graphViewportCanvas.offsetTop;
      scrollLeft = el.graphViewportCanvas.scrollLeft;
      scrollTop = el.graphViewportCanvas.scrollTop;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      e.preventDefault();
      const x = e.pageX - el.graphViewportCanvas.offsetLeft;
      const y = e.pageY - el.graphViewportCanvas.offsetTop;
      const walkX = (x - startX);
      const walkY = (y - startY);
      el.graphViewportCanvas.scrollLeft = scrollLeft - walkX;
      el.graphViewportCanvas.scrollTop = scrollTop - walkY;
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        el.graphViewportCanvas.style.cursor = 'grab';
      }
    });

    // Nav Pills filtering
    el.typeFilterPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;

      el.typeFilterPills.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      appState.filterType = btn.dataset.type;
      applyFilterAndSearch();
    });

    // Search bar input (debounced by 100ms)
    let searchDebounceTimer = null;
    el.searchBar.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value;
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        applyFilterAndSearch();
      }, 100);
    });

    // Scroll wheel zoom on graph viewport canvas
    el.graphViewportCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomIntensity = 0.05;
      if (e.deltaY < 0) {
        appState.zoomLevel = Math.min(2.0, appState.zoomLevel + zoomIntensity);
      } else {
        appState.zoomLevel = Math.max(0.5, appState.zoomLevel - zoomIntensity);
      }
      applyZoom();
    }, { passive: false });

    // Load demo data trigger
    const btnLoadDemo = document.getElementById('btn-load-demo-workspace');
    if (btnLoadDemo) {
      btnLoadDemo.addEventListener('click', () => {
        showLoader('Initializing demo workspace...', 'synapse');
        setTimeout(() => {
          const demoData = window.JiraParser.getMockData();
          updateWorkspaceDataset(demoData.epic, demoData.issues);
          hideLoader();
        }, 800);
      });
    }

    // Tabs navigation inside workspace
    el.tabsBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      appState.activeTab = btn.dataset.tab;
      renderActiveTabContent();
    });

    // Keyboard Arrow navigation triggers
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return; // Avoid intercepting text inputting
      }

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        navigateKeyboard(1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        navigateKeyboard(-1);
      }
    });

    // Modals visibility toggles
    el.btnImportJson.addEventListener('click', () => {
      el.modalImportJson.classList.add('active');
      el.importErrorBanner.style.display = 'none';
    });

    [el.btnCloseImportModal, el.btnCloseImportFooter].forEach(btn => {
      btn.addEventListener('click', () => el.modalImportJson.classList.remove('active'));
    });

    el.btnSubmitImport.addEventListener('click', handleJsonImportSubmit);

    // Epic Switcher trigger
    el.btnEpicSwitcherLoad.addEventListener('click', handleEpicSwitcherLoad);
    el.epicSwitcherInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleEpicSwitcherLoad();
      }
    });


  }

  // --- KEYBOARD LIST NAVIGATOR ---
  function navigateKeyboard(direction) {
    const listLen = appState.filteredIssues.length;
    if (listLen === 0) return;

    let nextIndex = appState.keyboardIndex + direction;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= listLen) nextIndex = listLen - 1;

    appState.keyboardIndex = nextIndex;
    const issueToSelect = appState.filteredIssues[nextIndex];
    selectIssue(issueToSelect);

    // Dynamic scroll container alignment
    const activeRow = el.ticketList.querySelector('.ticket-row.active');
    if (activeRow) {
      activeRow.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }

  // --- ACTIVE EPIC QUICK SWITCHER ---
  async function handleEpicSwitcherLoad() {
    let epicId = el.epicSwitcherInput.value.trim().toUpperCase();
    if (!epicId) {
      alert('Please enter an Epic Key first.');
      return;
    }

    // Auto-prepend prefix if only number is entered
    if (/^\d+$/.test(epicId)) {
      epicId = 'PROJ-' + epicId;
      el.epicSwitcherInput.value = epicId;
    }

    el.btnEpicSwitcherLoad.innerHTML = '<span class="material-symbols-outlined" style="font-size: 13px;">search</span> Loading...';
    el.btnEpicSwitcherLoad.disabled = true;

    try {
      showLoader('Running in Demo Mode: Loading sample Epic hierarchy...', 'synapse');
      await new Promise(r => setTimeout(r, 600));
      
      const demoData = window.JiraParser.getMockData();
      if (demoData && demoData.epic && demoData.issues) {
        if (epicId && demoData.epic) {
          demoData.epic.key = epicId;
        }
        updateWorkspaceDataset(demoData.epic, demoData.issues);
      }
      el.epicSwitcherInput.value = '';
    } finally {
      el.btnEpicSwitcherLoad.innerHTML = '<span class="material-symbols-outlined" style="font-size: 13px;">search</span> Load';
      el.btnEpicSwitcherLoad.disabled = false;
      hideLoader();
    }
  }

  // --- GEMINI LIVE AI FETCH & RENDER CORES ---

  function renderAICTA(container, issue) {
    container.innerHTML = '';
    const cta = document.createElement('div');
    cta.className = 'ai-cta-block';
    cta.innerHTML = `
      <div class="ai-cta-icon">
        <span class="material-symbols-outlined" style="font-size: 22px;">auto_awesome</span>
      </div>
      <p class="ai-cta-desc">Get instant risk assessment, open questions, and blocker analysis for this issue.</p>
      <button class="ai-cta-btn" id="btn-run-ai-analysis">
        <span class="material-symbols-outlined" style="font-size: 14px;">play_arrow</span>
        Generate Analysis
      </button>
    `;
    container.appendChild(cta);

    document.getElementById('btn-run-ai-analysis').addEventListener('click', () => {
      renderAISkeleton(container);
      fetchGeminiAIAnalysis(issue);
    });
  }

  function renderAISkeleton(container) {
    container.innerHTML = `
      <div class="ai-loading-state">
        <span class="material-symbols-outlined ai-loading-icon">auto_awesome</span>
        <span class="ai-loading-label">Analysing issue...</span>
      </div>
      <div class="skeleton skeleton-text" style="width: 100%; margin-top: 12px;"></div>
      <div class="skeleton skeleton-text" style="width: 88%;"></div>
      <div class="skeleton skeleton-text" style="width: 76%;"></div>
      <div class="skeleton skeleton-title" style="width: 40%; margin-top: 12px; height: 10px;"></div>
      <div class="skeleton skeleton-text" style="width: 92%;"></div>
      <div class="skeleton skeleton-text" style="width: 82%;"></div>
    `;
  }

  function renderAIContent(container, ai, isLive) {
    container.innerHTML = '';

    // Summary description paragraph
    const sumDiv = document.createElement('div');
    sumDiv.className = 'ai-text';
    sumDiv.textContent = ai.summary;
    container.appendChild(sumDiv);

    // Risks
    if (ai.risks && ai.risks.length > 0) {
      const title = document.createElement('div');
      title.className = 'ai-section-heading';
      title.textContent = 'Key Risks';
      container.appendChild(title);

      const ul = document.createElement('ul');
      ul.className = 'ai-bullet-list';
      ai.risks.forEach(r => {
        const li = document.createElement('li');
        li.textContent = r;
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }

    // Open Questions
    if (ai.openQuestions && ai.openQuestions.length > 0) {
      const title = document.createElement('div');
      title.className = 'ai-section-heading';
      title.textContent = 'Open Questions';
      container.appendChild(title);

      const ul = document.createElement('ul');
      ul.className = 'ai-bullet-list';
      ai.openQuestions.forEach(q => {
        const li = document.createElement('li');
        li.textContent = q;
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }

    // Potential Missing Acceptance Criteria
    if (ai.missingCriteria && ai.missingCriteria.length > 0) {
      const title = document.createElement('div');
      title.className = 'ai-section-heading';
      title.textContent = 'Potential Missing Criteria';
      container.appendChild(title);

      const ul = document.createElement('ul');
      ul.className = 'ai-bullet-list';
      ai.missingCriteria.forEach(m => {
        const li = document.createElement('li');
        li.textContent = m;
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }

    // Blockers & Action Items
    if (ai.blockers && ai.blockers.length > 0) {
      const title = document.createElement('div');
      title.className = 'ai-section-heading';
      title.textContent = 'Blockers & Action Items';
      container.appendChild(title);

      const ul = document.createElement('ul');
      ul.className = 'ai-bullet-list';
      ai.blockers.forEach(b => {
        const li = document.createElement('li');
        li.textContent = b;
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }

    // Regenerate footer
    const footer = document.createElement('div');
    footer.className = 'ai-regen-footer';
    footer.innerHTML = `
      <button class="ai-regen-btn" id="btn-regen-ai">
        <span class="material-symbols-outlined" style="font-size: 12px;">refresh</span>
        Regenerate
      </button>
    `;
    container.appendChild(footer);

    // Wire up regenerate — find current active issue
    const regenBtn = footer.querySelector('#btn-regen-ai');
    if (regenBtn && appState.activeIssue) {
      regenBtn.addEventListener('click', () => {
        const activeIssue = appState.activeIssue;
        activeIssue.aiAnalysisLive = null; // clear cache
        renderAISkeleton(container);
        fetchGeminiAIAnalysis(activeIssue);
      });
    }
  }

  async function fetchGeminiAIAnalysis(issue) {
    const issueKey = issue.key;

    // In Demo Mode: if pre-generated local AI analysis is present, load it seamlessly
    if (issue.aiAnalysis) {
      await new Promise(r => setTimeout(r, 600));
      issue.aiAnalysisLive = issue.aiAnalysis;
      if (appState.activeIssue && appState.activeIssue.key === issueKey) {
        renderAIContent(el.aiAnalysisContent, issue.aiAnalysis, true);
      }
      return;
    }

    try {
      const scriptUrl = typeof GOOGLE_SCRIPT_URL !== 'undefined' ? GOOGLE_SCRIPT_URL : window.GOOGLE_SCRIPT_URL;
      if (!scriptUrl) {
        throw new Error('Google Apps Script URL is not configured.');
      }

      // Clean up content summaries to prevent payload bloat
      const commentsText = (issue.comments || []).map(c => `${c.author}: ${c.content}`).join('\n') || 'None';
      const linksText = (issue.linkedIssues || []).map(l => `${l.relation} ${l.key} - ${l.summary}`).join('\n') || 'None';
      const acText = Array.isArray(issue.acceptanceCriteria) 
        ? issue.acceptanceCriteria.join('\n') 
        : (issue.acceptanceCriteria || 'None');

      const issuePayload = {
        key: issue.key,
        type: issue.type,
        summary: issue.summary,
        status: issue.status,
        priority: issue.priority,
        assignee: issue.assignee ? issue.assignee.name : 'Unassigned',
        sprint: issue.sprint || 'Unscheduled',
        storyPoints: issue.storyPoints !== null ? issue.storyPoints : 'Unestimated',
        description: issue.description || 'No description provided.',
        acceptanceCriteria: acText,
        commentsText: commentsText,
        linksText: linksText
      };

      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'gemini',
          issue: issuePayload
        })
      });

      if (!response.ok) {
        throw new Error(`Google Apps Script Proxy returned status ${response.status}`);
      }

      const resJson = await response.json();
      if (resJson.error) {
        throw new Error(`Google Apps Script: ${resJson.error}`);
      }

      const parsedAI = resJson.analysis;

      // Save in issue cache
      issue.aiAnalysisLive = parsedAI;

      // Only update DOM if the user hasn't switched issues during fetch
      if (appState.activeIssue && appState.activeIssue.key === issueKey) {
        renderAIContent(el.aiAnalysisContent, parsedAI, true);
      }
    } catch (err) {
      console.error(err);
      // Fallback
      if (appState.activeIssue && appState.activeIssue.key === issueKey) {
        renderAIContent(el.aiAnalysisContent, issue.aiAnalysis, false);
        const errorNotice = document.createElement('div');
        errorNotice.style.fontSize = '10px';
        errorNotice.style.color = 'var(--error)';
        errorNotice.style.marginTop = '8px';
        errorNotice.textContent = `Live AI failed: ${err.message}. Using rule-based fallback.`;
        el.aiAnalysisContent.appendChild(errorNotice);
      }
    }
  }

  // --- MANUAL JSON FILE IMPORT HANDLER ---
  function handleJsonImportSubmit() {
    el.importErrorBanner.style.display = 'none';
    const textData = el.jsonTextInput.value.trim();
    const file = el.jsonFileInput.files[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          processRawJsonString(e.target.result);
        } catch (err) {
          showImportError('File parse error: ' + err.message);
        }
      };
      reader.readAsText(file);
    } else if (textData) {
      try {
        processRawJsonString(textData);
      } catch (err) {
        showImportError('Pasted text parse error: ' + err.message);
      }
    } else {
      showImportError('Please select a JSON file or paste JSON payload.');
    }
  }

  async function processRawJsonString(rawStr) {
    try {
      showLoader('Parsing JSON payload...', 'jira');
      const parsed = JSON.parse(rawStr);
      
      // Validation
      if (!parsed.epic || !parsed.issues) {
        if (Array.isArray(parsed.issues)) {
          const epic = parsed.issues.find(i => i.fields && i.fields.issuetype && i.fields.issuetype.name === 'Epic');
          if (epic) {
            updateLoaderStatus('Assembling ticket hierarchy...');
            await new Promise(r => setTimeout(r, 400));
            const restIssues = parsed.issues.filter(i => i.key !== epic.key);
            const parsedData = window.JiraParser.parseJiraPayload(epic, restIssues);
            
            updateLoaderStatus('Constructing dependency graph...');
            await new Promise(r => setTimeout(r, 400));
            
            updateWorkspaceDataset(parsedData.epic, parsedData.issues);
            el.modalImportJson.classList.remove('active');
            return;
          }
        }
        throw new Error('JSON structure must contain an "epic" object and "issues" array, or a complete issues query result containing the epic.');
      }

      updateLoaderStatus('Assembling ticket hierarchy...');
      await new Promise(r => setTimeout(r, 400));
      const parsedData = window.JiraParser.parseJiraPayload(parsed.epic, parsed.issues);
      
      updateLoaderStatus('Constructing dependency graph...');
      await new Promise(r => setTimeout(r, 400));
      
      updateWorkspaceDataset(parsedData.epic, parsedData.issues);
      el.modalImportJson.classList.remove('active');
    } catch (err) {
      showImportError(err.message);
    } finally {
      hideLoader();
    }
  }

  function showImportError(msg) {
    el.importErrorMessage.textContent = msg;
    el.importErrorBanner.style.display = 'flex';
  }

  // --- INTERACTIVE DEPENDENCY GRAPH ENGINE ---

  let positions = {}; // Cache of computed node coordinates { x, y }

  function renderDependencyGraph() {
    if (!appState.epic || !appState.issues) return;

    // 1. Compute ranks (depths)
    let ranks = {};
    let tempVisited = new Set();

    function getRank(key) {
      if (key === appState.epic.key) return -1;
      if (key in ranks) return ranks[key];
      
      const issue = appState.issues.find(i => i.key === key);
      if (!issue) return 0;
      
      if (issue.type === 'Subtask' && issue.parentKey) {
        let pRank = getRank(issue.parentKey);
        ranks[key] = pRank + 1;
        return pRank + 1;
      }
      
      let blockers = [];
      if (issue.linkedIssues) {
        issue.linkedIssues.forEach(link => {
          if (link.relation === 'is blocked by' || link.relation === 'blocked by') {
            blockers.push(link.key);
          }
        });
      }

      if (tempVisited.has(key)) {
        return 0; // break cycle
      }

      tempVisited.add(key);
      let maxBlockerRank = -1;
      blockers.forEach(bKey => {
        let bRank = getRank(bKey);
        if (bRank > maxBlockerRank) {
          maxBlockerRank = bRank;
        }
      });
      tempVisited.delete(key);

      let rank = maxBlockerRank + 1;
      ranks[key] = rank;
      return rank;
    }

    appState.issues.forEach(i => {
      getRank(i.key);
    });

    // 2. Gather visible hierarchy tiers starting from the Epic root (collapsible tree nodes)
    let visibleIssuesSet = new Set();
    let issueTiers = {};

    function collectVisibleTree(parentKey, tier) {
      if (appState.collapsedNodes.has(parentKey)) return;
      
      let children = [];
      if (parentKey === appState.epic.key) {
        // Primary issues (Stories, Tasks, Bugs) directly under Epic (non-subtasks)
        children = appState.issues.filter(i => i.type !== 'Subtask');
      } else {
        if (appState.showGraphSubtasks) {
          const parentIssue = appState.issues.find(i => i.key === parentKey);
          children = appState.issues.filter(i => 
            i.type === 'Subtask' && 
            (i.parentKey === parentKey || (parentIssue && parentIssue.subtasks && parentIssue.subtasks.includes(i.key)))
          );
        }
      }
      
      children.forEach(c => {
        if (!visibleIssuesSet.has(c.key)) {
          c._tier = tier;
          issueTiers[c.key] = tier;
          visibleIssuesSet.add(c.key);
          collectVisibleTree(c.key, tier + 1);
        }
      });
    }

    appState.epic._tier = 0;
    issueTiers[appState.epic.key] = 0;
    visibleIssuesSet.add(appState.epic.key);
    collectVisibleTree(appState.epic.key, 1);

    let issuesToRender = appState.issues.filter(i => visibleIssuesSet.has(i.key));
    let allItems = [appState.epic, ...issuesToRender];

    // 3. Compute tree coordinates using a depth-first traversal (SAP HRMS style centering)
    positions = {};
    let currentY = 80;
    let currentX = 80;

    function layoutTreeHorizontal(key, colNum) {
      let x = colNum * 280 + 50;
      
      let children = [];
      if (key === appState.epic.key) {
        children = issuesToRender.filter(i => i._tier === 1);
      } else {
        if (appState.showGraphSubtasks) {
          const parentIssue = issuesToRender.find(i => i.key === key);
          children = issuesToRender.filter(c => 
            c.type === 'Subtask' && 
            (c.parentKey === key || (parentIssue && parentIssue.subtasks && parentIssue.subtasks.includes(c.key)))
          );
        }
      }
      
      if (children.length === 0) {
        positions[key] = { x: x, y: currentY };
        currentY += 105;
      } else {
        let childYs = [];
        children.forEach(c => {
          layoutTreeHorizontal(c.key, colNum + 1);
          childYs.push(positions[c.key].y);
        });
        let avgY = childYs.reduce((a, b) => a + b, 0) / childYs.length;
        positions[key] = { x: x, y: avgY };
      }
    }

    function layoutTreeVertical(key, rowNum) {
      let y = rowNum * 180 + 50;
      
      let children = [];
      if (key === appState.epic.key) {
        children = issuesToRender.filter(i => i._tier === 1);
      } else {
        if (appState.showGraphSubtasks) {
          const parentIssue = issuesToRender.find(i => i.key === key);
          children = issuesToRender.filter(c => 
            c.type === 'Subtask' && 
            (c.parentKey === key || (parentIssue && parentIssue.subtasks && parentIssue.subtasks.includes(c.key)))
          );
        }
      }
      
      if (children.length === 0) {
        positions[key] = { x: currentX, y: y };
        currentX += 240;
      } else {
        let childXs = [];
        children.forEach(c => {
          layoutTreeVertical(c.key, rowNum + 1);
          childXs.push(positions[c.key].x);
        });
        let avgX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
        positions[key] = { x: avgX, y: y };
      }
    }

    if (appState.graphLayout === 'horz') {
      layoutTreeHorizontal(appState.epic.key, 0);
    } else {
      layoutTreeVertical(appState.epic.key, 0);
    }

    // Calculate the critical path (longest chain of uncompleted dependent issues)
    let memo = {};
    let pathMap = {};
    let temp = new Set();
    
    function getPathInfo(key) {
      if (key in memo) return { depth: memo[key], path: pathMap[key] };
      if (temp.has(key)) return { depth: 0, path: [] };
      
      temp.add(key);
      const issue = appState.issues.find(i => i.key === key);
      if (!issue || isStatusDone(issue.status)) {
        temp.delete(key);
        return { depth: 0, path: [key] };
      }
      
      let blockers = [];
      if (issue.linkedIssues) {
        issue.linkedIssues.forEach(l => {
          if (l.relation === 'is blocked by' || l.relation === 'blocked by') {
            blockers.push(l.key);
          }
        });
      }
      
      let maxSubDepth = -1;
      let bestPath = [];
      blockers.forEach(bKey => {
        let info = getPathInfo(bKey);
        if (info.depth > maxSubDepth) {
          maxSubDepth = info.depth;
          bestPath = info.path;
        }
      });
      
      temp.delete(key);
      let currentDepth = maxSubDepth + 1;
      let currentPath = [key].concat(bestPath);
      
      memo[key] = currentDepth;
      pathMap[key] = currentPath;
      return { depth: currentDepth, path: currentPath };
    }
    
    let maxCriticalDepth = -1;
    let criticalPathArray = [];
    issuesToRender.forEach(i => {
      let info = getPathInfo(i.key);
      if (info.depth > maxCriticalDepth) {
        maxCriticalDepth = info.depth;
        criticalPathArray = info.path;
      }
    });
    let criticalPathSet = new Set(criticalPathArray);

    // Identify the worst active bottleneck
    let bottlenecks = getBottlenecks();
    let worstBottleneckKey = bottlenecks.length > 0 ? bottlenecks[0].key : null;

    // Adjust canvas/viewport size dynamically
    let maxX = 1200;
    let maxY = 800;
    Object.keys(positions).forEach(key => {
      let pos = positions[key];
      if (pos.x + 260 > maxX) maxX = pos.x + 260;
      if (pos.y + 150 > maxY) maxY = pos.y + 150;
    });

    el.graphNodesWrapper.style.width = maxX + 'px';
    el.graphNodesWrapper.style.height = maxY + 'px';
    el.graphSvgConnections.setAttribute('width', maxX);
    el.graphSvgConnections.setAttribute('height', maxY);

    // 4. Render Connection Lines
    let drawn = new Set();
    let pathHtml = '';
    const cardWidth = 220;
    const cardHeight = 80;

    function drawConnection(fromKey, toKey, type) {
      let connKey = `${fromKey}->${toKey}`;
      if (drawn.has(connKey)) return;
      drawn.add(connKey);

      let p1 = positions[fromKey];
      let p2 = positions[toKey];
      if (!p1 || !p2) return;

      let startX, startY, endX, endY;
      let pathD = '';

      if (appState.graphLayout === 'horz') {
        if (p2.x > p1.x) {
          startX = p1.x + cardWidth;
          startY = p1.y + cardHeight / 2;
          endX = p2.x;
          endY = p2.y + cardHeight / 2;
        } else {
          startX = p1.x;
          startY = p1.y + cardHeight / 2;
          endX = p2.x + cardWidth;
          endY = p2.y + cardHeight / 2;
        }
        if (type === 'parent') {
          let midX = startX + (endX - startX) * 0.4;
          pathD = `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
        } else {
          let dx = Math.abs(endX - startX) * 0.5;
          pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
        }
      } else {
        if (p2.y > p1.y) {
          startX = p1.x + cardWidth / 2;
          startY = p1.y + cardHeight;
          endX = p2.x + cardWidth / 2;
          endY = p2.y;
        } else {
          startX = p1.x + cardWidth / 2;
          startY = p1.y;
          endX = p2.x + cardWidth / 2;
          endY = p2.y + cardHeight;
        }
        if (type === 'parent') {
          let midY = startY + (endY - startY) * 0.4;
          pathD = `M ${startX} ${startY} V ${midY} H ${endX} V ${endY}`;
        } else {
          let dy = Math.abs(endY - startY) * 0.5;
          pathD = `M ${startX} ${startY} C ${startX} ${startY + dy}, ${endX} ${endY - dy}, ${endX} ${endY}`;
        }
      }

      let isCritical = criticalPathSet.has(fromKey) && criticalPathSet.has(toKey);
      let lineClass = 'graph-line';
      let marker = 'url(#arrow)';
      
      if (type === 'parent') {
        lineClass = 'graph-line parent-line';
        marker = ''; // No arrows for tree paths in SAP style
      } else if (isCritical) {
        lineClass = 'graph-line critical-path';
        marker = 'url(#arrow-blocked)';
      } else if (type === 'blocked') {
        lineClass = 'graph-line blocked';
        marker = 'url(#arrow-blocked)';
      } else if (type === 'active') {
        lineClass = 'graph-line active';
        marker = 'url(#arrow-active)';
      }

      let markerAttr = marker ? `marker-end="${marker}"` : '';
      pathHtml += `<path d="${pathD}" class="${lineClass}" data-from="${fromKey}" data-to="${toKey}" ${markerAttr}></path>`;
    }

    allItems.forEach(item => {
      // Parent-child links
      let pKey = item.parentKey;
      if (!pKey && item.type === 'Subtask') {
        const parent = allItems.find(p => p.subtasks && p.subtasks.includes(item.key));
        if (parent) {
          pKey = parent.key;
        }
      }

      if (pKey && positions[pKey]) {
        drawConnection(pKey, item.key, 'parent');
      }
      
      // Direct Epic-child links
      if (item.key !== appState.epic.key && !pKey && item.type !== 'Subtask') {
        drawConnection(appState.epic.key, item.key, 'parent');
      }

      // Dependency links
      if (item.linkedIssues) {
        item.linkedIssues.forEach(link => {
          if (positions[link.key]) {
            if (link.relation === 'is blocked by' || link.relation === 'blocked by') {
              drawConnection(link.key, item.key, 'blocked');
            } else if (link.relation === 'blocks') {
              drawConnection(item.key, link.key, 'active');
            } else {
              drawConnection(item.key, link.key, 'normal');
            }
          }
        });
      }
    });

    const defsHtml = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--outline-variant)" />
        </marker>
        <marker id="arrow-active" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--primary-container)" />
        </marker>
        <marker id="arrow-blocked" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 2 L 8 5 L 0 8 z" fill="var(--error)" />
        </marker>
      </defs>
    `;
    el.graphSvgConnections.innerHTML = defsHtml + pathHtml;

    // 5. Render Node Cards
    const oldBanners = el.graphNodesWrapper.querySelectorAll('.graph-empty-banner');
    oldBanners.forEach(b => b.remove());

    const oldNodes = el.graphNodesWrapper.querySelectorAll('.graph-node');
    oldNodes.forEach(n => n.remove());

    let nodesHtml = '';
    allItems.forEach(item => {
      let pos = positions[item.key];
      if (!pos) return;

      let nodeClass = 'graph-node';
      if (appState.activeIssue && appState.activeIssue.key === item.key) {
        nodeClass += ' active';
      }
      if (isStatusDone(item.status)) {
        nodeClass += ' done';
      } else if (item.status === 'Blocked' || item.linkedIssues.some(l => l.relation === 'is blocked by' && !isStatusDone(l.status))) {
        nodeClass += ' blocked';
      }
      if (item.key === worstBottleneckKey) {
        nodeClass += ' bottleneck-flag';
      }

      const iconImg = item.iconUrl 
        ? `<img src="${item.iconUrl}" alt="" style="width: 9px; height: 9px; object-fit: contain; margin-right: 2px; vertical-align: middle;" onerror="this.remove();">` 
        : '';
      let typeBadge = `<span class="type-badge ${item.type.toLowerCase()}" style="font-size: 8px; padding: 1px 4px; display: inline-flex; align-items: center; justify-content: center; height: 14px;">${iconImg}<span>${item.type}</span></span>`;
      let pointsBadge = item.storyPoints !== null ? `<span style="font-size: 9px; color: var(--on-surface-variant); background: var(--surface-container-highest); padding: 1px 4px; border-radius: 2px;">${item.storyPoints} SP</span>` : '';
      let criticalBadge = criticalPathSet.has(item.key) ? '<span style="font-size: 7px; font-weight: 700; color: #c084fc; border: 1px solid #c084fc; padding: 0px 3px; border-radius: 2px; text-transform: uppercase;">Critical</span>' : '';
      let bottleneckBadge = item.key === worstBottleneckKey ? '<span style="font-size: 7px; font-weight: 700; color: #ef4444; border: 1px solid #ef4444; padding: 0px 3px; border-radius: 2px; text-transform: uppercase;">Bottleneck</span>' : '';

      let assigneeName = item.assignee ? item.assignee.name : 'Unassigned';
      let assigneeInitials = item.assignee ? item.assignee.avatar : 'UN';
      const avatarImgHtml = item.assignee && item.assignee.avatarUrl
        ? `<img src="${item.assignee.avatarUrl}" alt="" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.remove();">`
        : '';

      // Check if node has children/branches to collapse
      let hasChildren = false;
      if (item.key === appState.epic.key) {
        hasChildren = appState.issues.some(i => i.type !== 'Subtask');
      } else {
        hasChildren = appState.showGraphSubtasks && (
          (item.subtasks && item.subtasks.length > 0) || 
          appState.issues.some(i => i.type === 'Subtask' && i.parentKey === item.key)
        );
      }

      let toggleBtnHtml = '';
      if (hasChildren) {
        let isCollapsed = appState.collapsedNodes.has(item.key);
        let toggleIcon = isCollapsed ? '+' : '−';
        let toggleClass = isCollapsed ? 'collapsed' : 'expanded';
        let layoutClass = appState.graphLayout === 'horz' ? 'toggle-horz' : 'toggle-vert';
        toggleBtnHtml = `
          <button class="node-toggle-btn ${toggleClass} ${layoutClass}" data-toggle-key="${item.key}" title="${isCollapsed ? 'Expand branch' : 'Collapse branch'}">
            <span>${toggleIcon}</span>
          </button>
        `;
      }

      nodesHtml += `
        <div class="${nodeClass}" style="left: ${pos.x}px; top: ${pos.y}px;" data-key="${item.key}">
          <div class="graph-node-avatar-container">
            <div class="graph-node-avatar" title="Assignee: ${assigneeName}" style="position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
              <span>${assigneeInitials}</span>
              ${avatarImgHtml}
            </div>
          </div>
          <div class="graph-node-main">
            <div class="graph-node-header">
              <span class="graph-node-key">${item.key}</span>
              <div style="display: flex; gap: 3px; align-items: center;">
                ${criticalBadge}
                ${bottleneckBadge}
                ${typeBadge}
              </div>
            </div>
            <div class="graph-node-summary" title="${item.summary}">${item.summary}</div>
            <div class="graph-node-assignee" title="${assigneeName}">${assigneeName}</div>
            <div class="graph-node-footer">
              <span class="badge ${getStatusBadgeClass(item.status)}" style="font-size: 8px; padding: 1px 4px;">${item.status}</span>
              ${pointsBadge}
            </div>
          </div>
          ${toggleBtnHtml}
        </div>
      `;
    });

    el.graphNodesWrapper.insertAdjacentHTML('beforeend', nodesHtml);

    // Bind collapsible node toggle buttons
    el.graphNodesWrapper.querySelectorAll('.node-toggle-btn').forEach(btn => {
      const stopProp = (e) => {
        e.stopPropagation();
        e.preventDefault();
      };
      btn.addEventListener('click', stopProp);
      btn.addEventListener('dblclick', stopProp);
      btn.addEventListener('mousedown', stopProp);
      btn.addEventListener('mouseup', stopProp);
      btn.addEventListener('click', (e) => {
        let key = btn.dataset.toggleKey;
        if (appState.collapsedNodes.has(key)) {
          appState.collapsedNodes.delete(key);
        } else {
          appState.collapsedNodes.add(key);
        }
        renderDependencyGraph();
      });
    });

    // Helpers to collect recursive blocker (upstream) and dependent (downstream) paths
    function getUpstreamPath(key, visited = new Set()) {
      if (visited.has(key)) return visited;
      visited.add(key);
      let issue = appState.issues.find(i => i.key === key) || (appState.epic.key === key ? appState.epic : null);
      if (!issue) return visited;
      
      let blockers = [];
      if (issue.linkedIssues) {
        issue.linkedIssues.forEach(l => {
          if (l.relation === 'is blocked by' || l.relation === 'blocked by') {
            blockers.push(l.key);
          }
        });
      }
      if (issue.parentKey) {
        blockers.push(issue.parentKey);
      }
      blockers.forEach(b => getUpstreamPath(b, visited));
      return visited;
    }

    function getDownstreamPath(key, visited = new Set()) {
      if (visited.has(key)) return visited;
      visited.add(key);
      
      appState.issues.forEach(i => {
        let isLinked = false;
        if (i.linkedIssues) {
          i.linkedIssues.forEach(l => {
            if ((l.relation === 'is blocked by' || l.relation === 'blocked by') && l.key === key) {
              isLinked = true;
            }
          });
        }
        if (i.parentKey === key) {
          isLinked = true;
        }
        if (isLinked) {
          getDownstreamPath(i.key, visited);
        }
      });
      return visited;
    }

    // Bind card clicks and interactive hover path-tracing
    el.graphNodesWrapper.querySelectorAll('.graph-node').forEach(node => {
      node.addEventListener('click', (e) => {
        let key = node.dataset.key;
        let selected = appState.issues.find(i => i.key === key) || (appState.epic.key === key ? appState.epic : null);
        if (selected) {
          selectIssue(selected);
          
          el.graphNodesWrapper.querySelectorAll('.graph-node').forEach(n => {
            if (n.dataset.key === key) {
              n.classList.add('active');
            } else {
              n.classList.remove('active');
            }
          });
        }
      });

      node.addEventListener('dblclick', (e) => {
        let key = node.dataset.key;
        let selected = appState.issues.find(i => i.key === key) || (appState.epic.key === key ? appState.epic : null);
        if (selected) {
          selectIssue(selected);
          el.navWorkspaceLink.click();
        }
      });

      // FAANG Path Tracing Hover Effects
      node.addEventListener('mouseenter', () => {
        let hoverKey = node.dataset.key;
        let upstream = getUpstreamPath(hoverKey);
        let downstream = getDownstreamPath(hoverKey);
        
        el.graphNodesWrapper.querySelectorAll('.graph-node').forEach(n => {
          let k = n.dataset.key;
          if (k === hoverKey) {
            // Highlight node under hover normally
          } else if (upstream.has(k)) {
            n.classList.add('highlight-upstream');
          } else if (downstream.has(k)) {
            n.classList.add('highlight-downstream');
          } else {
            n.classList.add('faded');
          }
        });

        el.graphSvgConnections.querySelectorAll('.graph-line').forEach(line => {
          let from = line.dataset.from;
          let to = line.dataset.to;
          let edgeActive = (upstream.has(from) && (upstream.has(to) || to === hoverKey)) ||
                           (downstream.has(to) && (downstream.has(from) || from === hoverKey)) ||
                           (from === hoverKey && downstream.has(to)) ||
                           (to === hoverKey && upstream.has(from));
          if (!edgeActive) {
            line.classList.add('faded');
          }
        });
      });

      node.addEventListener('mouseleave', () => {
        el.graphNodesWrapper.querySelectorAll('.graph-node').forEach(n => {
          n.classList.remove('faded', 'highlight-upstream', 'highlight-downstream');
        });
        el.graphSvgConnections.querySelectorAll('.graph-line').forEach(line => {
          line.classList.remove('faded');
        });
      });
    });

    // 6. Apply zoom and render sidebar
    applyZoom();
    renderGraphSidebar();
  }

  function applyZoom() {
    el.zoomValueLabel.textContent = Math.round(appState.zoomLevel * 100) + '%';
    el.graphNodesWrapper.style.transform = `scale(${appState.zoomLevel})`;
  }

  function centerGraphViewport() {
    let canvasWidth = el.graphViewportCanvas.clientWidth;
    let canvasHeight = el.graphViewportCanvas.clientHeight;
    
    let activeKey = appState.activeIssue ? appState.activeIssue.key : appState.epic.key;
    let pos = positions[activeKey];
    
    if (pos) {
      let left = (pos.x * appState.zoomLevel) - (canvasWidth / 2) + (110 * appState.zoomLevel);
      let top = (pos.y * appState.zoomLevel) - (canvasHeight / 2) + (40 * appState.zoomLevel);
      
      el.graphViewportCanvas.scrollLeft = Math.max(0, left);
      el.graphViewportCanvas.scrollTop = Math.max(0, top);
    } else {
      let scrollW = el.graphNodesWrapper.clientWidth * appState.zoomLevel;
      let scrollH = el.graphNodesWrapper.clientHeight * appState.zoomLevel;
      el.graphViewportCanvas.scrollLeft = (scrollW - canvasWidth) / 2;
      el.graphViewportCanvas.scrollTop = (scrollH - canvasHeight) / 2;
    }
  }

  function calculateCriticalPathDepth() {
    let memo = {};
    let temp = new Set();
    
    function getMaxDepth(key) {
      if (key in memo) return memo[key];
      if (temp.has(key)) return 0;
      
      temp.add(key);
      const issue = appState.issues.find(i => i.key === key);
      if (!issue) {
        temp.delete(key);
        return 0;
      }
      
      let blockers = [];
      if (issue.linkedIssues) {
        issue.linkedIssues.forEach(l => {
          if (l.relation === 'is blocked by' || l.relation === 'blocked by') {
            blockers.push(l.key);
          }
        });
      }
      
      let maxSubDepth = 0;
      blockers.forEach(bKey => {
        let d = getMaxDepth(bKey);
        if (d > maxSubDepth) maxSubDepth = d;
      });
      
      temp.delete(key);
      let depth = maxSubDepth + 1;
      memo[key] = depth;
      return depth;
    }
    
    let maxDepth = 0;
    appState.issues.forEach(i => {
      let d = getMaxDepth(i.key);
      if (d > maxDepth) maxDepth = d;
    });
    
    return maxDepth;
  }

  function getBottlenecks() {
    let directlyBlocks = {};
    appState.issues.forEach(i => {
      if (i.linkedIssues) {
        i.linkedIssues.forEach(l => {
          if (l.relation === 'is blocked by' || l.relation === 'blocked by') {
            if (!directlyBlocks[l.key]) directlyBlocks[l.key] = new Set();
            directlyBlocks[l.key].add(i.key);
          } else if (l.relation === 'blocks') {
            if (!directlyBlocks[i.key]) directlyBlocks[i.key] = new Set();
            directlyBlocks[i.key].add(l.key);
          }
        });
      }
    });
    
    let bottlenecks = [];
    Object.keys(directlyBlocks).forEach(bKey => {
      let visited = new Set();
      let queue = Array.from(directlyBlocks[bKey]);
      queue.forEach(q => visited.add(q));
      
      while (queue.length > 0) {
        let current = queue.shift();
        if (directlyBlocks[current]) {
          directlyBlocks[current].forEach(child => {
            if (!visited.has(child)) {
              visited.add(child);
              queue.push(child);
            }
          });
        }
      }
      
      const issue = appState.issues.find(i => i.key === bKey);
      if (issue && !isStatusDone(issue.status)) {
        bottlenecks.push({
          key: bKey,
          summary: issue.summary,
          blocksCount: visited.size,
          status: issue.status
        });
      }
    });
    
    bottlenecks.sort((a, b) => b.blocksCount - a.blocksCount);
    return bottlenecks.slice(0, 3);
  }

  function getHighRiskPaths() {
    let paths = [];
    
    appState.issues.forEach(i => {
      if (i.linkedIssues) {
        i.linkedIssues.forEach(l => {
          if (l.relation === 'is blocked by' || l.relation === 'blocked by') {
            let blocker = appState.issues.find(x => x.key === l.key);
            if (blocker && !isStatusDone(blocker.status) && !isStatusDone(i.status)) {
              paths.push({
                from: blocker.key,
                to: i.key,
                progress: blocker.status === 'In Progress' ? 50 : 10,
                statusText: blocker.status === 'Blocked' ? 'Stalled' : 'Active'
              });
            }
          }
        });
      }
    });
    
    return paths.slice(0, 2);
  }

  function renderGraphSidebar() {
    el.graphTotalNodes.textContent = appState.issues.length + 1;
    el.graphEpicKey.textContent = appState.epic.key;

    let depth = calculateCriticalPathDepth();
    el.graphCriticalPath.innerHTML = `${depth} <span style="font-size: 11px; font-weight: normal; color: var(--on-surface-variant);">hops</span>`;

    let bottlenecks = getBottlenecks();
    el.graphBlockedCount.textContent = `${bottlenecks.length} BLOCKED`;
    
    el.graphBottlenecksList.innerHTML = '';
    if (bottlenecks.length > 0) {
      bottlenecks.forEach(b => {
        const div = document.createElement('div');
        div.className = 'context-item';
        div.style.padding = '10px';
        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="context-item-key">${b.key}</span>
            </div>
            <span class="badge badge-blocked" style="font-size: 8px; padding: 1px 5px;">Blocks ${b.blocksCount}</span>
          </div>
          <div style="font-size: 11px; color: var(--on-surface-variant); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${b.summary}</div>
        `;
        div.addEventListener('click', () => {
          let selected = appState.issues.find(i => i.key === b.key);
          if (selected) selectIssue(selected);
        });
        el.graphBottlenecksList.appendChild(div);
      });
    } else {
      el.graphBottlenecksList.innerHTML = '<p style="font-style:italic; font-size:11px; color:var(--on-surface-variant); text-align:center; padding: 12px 0;">No active bottleneck issues detected.</p>';
    }

    let paths = getHighRiskPaths();
    el.graphRiskPaths.innerHTML = '';
    if (paths.length > 0) {
      paths.forEach(p => {
        const div = document.createElement('div');
        div.style.padding = '10px';
        div.style.borderBottom = '1px solid rgba(141, 144, 161, 0.15)';
        
        let barColor = p.statusText === 'Stalled' ? 'var(--error)' : 'var(--primary-container)';
        div.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; margin-bottom: 6px;">
            <span class="context-item-key" style="font-weight: 600;">${p.from}</span>
            <span class="material-symbols-outlined" style="font-size:12px; color: var(--on-surface-variant);">arrow_right_alt</span>
            <span class="context-item-key" style="font-weight: 600;">${p.to}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="height: 4px; flex-grow: 1; background: var(--surface-container-highest); border-radius: 2px; overflow: hidden;">
              <div style="height: 100%; width: ${p.progress}%; background: ${barColor};"></div>
            </div>
            <span style="font-size: 10px; color: var(--on-surface-variant);">${p.statusText}</span>
          </div>
        `;
        el.graphRiskPaths.appendChild(div);
      });
    } else {
      el.graphRiskPaths.innerHTML = '<p style="font-style:italic; font-size:11px; color:var(--on-surface-variant); text-align:center; padding: 12px 0;">No high-risk paths detected.</p>';
    }
  }

  function parseMarkdownToHTML(md) {
    if (!md) return '<p style="opacity:0.5; font-style:italic;">No description provided.</p>';

    // Normalize newlines and strip BOM
    md = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '');
    md = md.replace(/[｜│]/g, '|'); // Normalize full-width and box-drawing pipes

    // 1. Normalize Jira Wiki Markup elements to Markdown:
    md = md
      .replace(/^h1\.\s*/gm, '# ')
      .replace(/^h2\.\s*/gm, '## ')
      .replace(/^h3\.\s*/gm, '### ')
      .replace(/^h4\.\s*/gm, '#### ')
      .replace(/^bq\.\s*/gm, '> ')
      // Jira bold/italic
      .replace(/\*([^\s*](?:[^*]*[^\s*])?)\*/g, function(match, inner) {
        if (inner.indexOf('*') === 0 || inner.lastIndexOf('*') === inner.length - 1) {
          return match;
        }
        return '**' + inner + '**';
      })
      .replace(/_([^\s_](?:[^_]*[^\s_])?)_/g, '*$1*')
      // Monospace
      .replace(/\{\{([^}]+)\}\}/g, '`$1`')
      // Code blocks
      .replace(/\{code(?::[^}]*)?\}([\s\S]*?)\{code\}/g, (_, inner) => '```\n' + inner.trim() + '\n```')
      .replace(/\{noformat\}([\s\S]*?)\{noformat\}/g, (_, inner) => '```\n' + inner.trim() + '\n```');

    // 2. Preprocess line continuation: merge lines ending with a backslash or incomplete table rows
    const lines = md.split('\n');
    const mergedLines = [];
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();
      
      const startsWithPipe = trimmed.startsWith('|');
      const endsWithPipe = trimmed.endsWith('|') && trimmed.length >= 1;
      
      if (startsWithPipe && !endsWithPipe) {
        // Incomplete table row! Merge subsequent lines only if they also start with a pipe '|',
        // until we find one ending in '|' (to avoid swallowing non-table lines)
        while (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const nextTrimmed = nextLine.trim();
          if (!nextTrimmed.startsWith('|')) {
            break;
          }
          const cleanedLine = line.replace(/\\+\s*$/, '');
          line = cleanedLine + '<br>' + nextLine;
          i++;
          if (nextTrimmed.endsWith('|') && nextTrimmed.length >= 1) {
            break;
          }
        }
      } else {
        // Check if line ends with a backslash for explicit continuation
        while (i + 1 < lines.length) {
          const trimmedLine = line.trim();
          if (/\\+\s*$/.test(trimmedLine)) {
            const cleanedLine = line.replace(/\\+\s*$/, '');
            line = cleanedLine + '<br>' + lines[i + 1];
            i++;
          } else {
            break;
          }
        }
      }
      mergedLines.push(line);
    }

    // 3. Preprocess Jira-style and missing-separator tables to standard Markdown tables
    const processedLines = [];
    let inTable = false;

    for (let i = 0; i < mergedLines.length; i++) {
      const line = mergedLines[i];
      const trimmed = line.trim();
      
      const isJiraHeader = trimmed.startsWith('||') && trimmed.endsWith('||');
      const isNormalRow = trimmed.startsWith('|') && trimmed.endsWith('|') && !trimmed.startsWith('||');
      
      if (isJiraHeader) {
        const parts = trimmed.split('||').map(p => p.trim());
        if (parts[0] === '') parts.shift();
        if (parts[parts.length - 1] === '') parts.pop();
        
        const converted = '| ' + parts.join(' | ') + ' |';
        processedLines.push(converted);
        
        const colCount = parts.length;
        const separator = '|' + ' --- |'.repeat(colCount);
        processedLines.push(separator);
        inTable = true;
      } else if (isNormalRow) {
        processedLines.push(line);
        if (!inTable) {
          inTable = true;
          let hasSeparator = false;
          if (i + 1 < mergedLines.length) {
            const nextTrimmed = mergedLines[i + 1].trim();
            if (nextTrimmed.startsWith('|') && nextTrimmed.endsWith('|')) {
              if (/^[|:\-\s]+$/.test(nextTrimmed)) {
                hasSeparator = true;
              }
            }
          }
          if (!hasSeparator) {
            const parts = trimmed.split('|').map(p => p.trim());
            if (parts[0] === '') parts.shift();
            if (parts[parts.length - 1] === '') parts.pop();
            const colCount = parts.length;
            const separator = '|' + ' --- |'.repeat(colCount);
            processedLines.push(separator);
          }
        }
      } else {
        inTable = false;
        processedLines.push(line);
      }
    }

    const finalMd = processedLines.join('\n');

    // 3. Render Markdown to HTML using marked.js
    if (typeof marked !== 'undefined') {
      try {
        let html = marked.parse(finalMd);
        if (typeof DOMPurify !== 'undefined') {
          html = DOMPurify.sanitize(html);
        }
        // Wrap tables in responsive container
        html = html.replace(/<table>/g, '<div class="table-container"><table class="desc-table">')
                   .replace(/<\/table>/g, '</table></div>');
        return html;
      } catch (e) {
        console.error("Error parsing markdown with marked.js: ", e);
      }
    }

    // Fallback: If marked is not available
    return '<pre style="white-space: pre-wrap; font-family: monospace;">' + finalMd + '</pre>';
  }

  // --- BADGE STYLE HELPERS ---
  function getStatusBadgeClass(status) {
    const cleanStatus = (status || '').toLowerCase();
    if (cleanStatus === 'done' || cleanStatus === 'resolved' || cleanStatus === 'closed') {
      return 'badge-done';
    } else if (cleanStatus === 'in progress' || cleanStatus === 'active') {
      return 'badge-inprogress';
    } else if (cleanStatus === 'in review' || cleanStatus === 'review') {
      return 'badge-inreview';
    } else if (cleanStatus === 'blocked' || cleanStatus === 'flagged') {
      return 'badge-blocked';
    } else {
      return 'badge-todo';
    }
  }

  function isStatusDone(status) {
    const s = (status || '').toLowerCase();
    return s === 'done' || s === 'resolved' || s === 'closed';
  }

  function renderEmptyState() {
    appState.epic = null;
    appState.issues = [];
    appState.activeIssue = null;
    appState.filteredIssues = [];

    // Left Panel Header Reset
    el.epicTitle.textContent = 'No Epic Loaded';
    el.epicStatusBadge.textContent = 'EMPTY';
    el.graphEpicKey.textContent = '--';
    el.epicStatusBadge.className = 'badge badge-todo';
    el.epicProgressBar.style.width = '0%';
    el.epicIssuesTotal.textContent = '0 Issues';
    el.epicIssuesDone.textContent = '0';
    el.epicIssuesOpen.textContent = '0';

    // Left Panel List Reset
    el.ticketList.innerHTML = `
      <div class="empty-placeholder" style="padding: 32px 16px; height: 100%; justify-content: center;">
        <span class="material-symbols-outlined" style="font-size: 32px; color: var(--outline);">folder_open</span>
        <div class="empty-placeholder-title" style="margin-top: 8px;">Explorer is Empty</div>
        <p class="empty-placeholder-desc" style="margin-bottom: 16px; font-size:11px; max-width: 200px; margin-left:auto; margin-right:auto;">
          Load an Epic key from the top bar or import a JSON hierarchy to start.
        </p>
      </div>
    `;

    // Center Panel Reset
    el.issueKeyDisplay.textContent = 'GETTING STARTED';
    el.issueTypeBadgeContainer.innerHTML = '';
    el.issueTitleDisplay.textContent = 'Epic Analyzer Command Center';
    el.metaStatus.textContent = '--';
    el.metaAssignee.textContent = '--';
    el.metaPriority.textContent = '--';
    el.metaSprint.textContent = '--';
    el.metaPoints.textContent = '--';
    el.metaUpdated.textContent = '--';
    el.metaReporter.textContent = '--';
    
    // Hide all tab panels
    const panels = el.tabContentArea.querySelectorAll('.tab-content-panel');
    panels.forEach(p => p.classList.remove('active'));

    // Show empty state panel
    const emptyStatePanel = document.getElementById('tab-empty-state');
    if (emptyStatePanel) emptyStatePanel.classList.add('active');

    // Hide tabs bar
    if (el.tabsBar) el.tabsBar.style.display = 'none';

    // Right Panel Context Reset
    el.sidebarParentContext.innerHTML = '<p style="font-style:italic; font-size:11px; color:var(--on-surface-variant); text-align:center; padding: 8px 0;">No active parents.</p>';
    el.sidebarChildContext.innerHTML = '<p style="font-style:italic; font-size:11px; color:var(--on-surface-variant); text-align:center; padding: 8px 0;">No active subtasks.</p>';
    el.aiAnalysisContent.innerHTML = `
      <div style="font-size: 11px; color: var(--on-surface-variant); line-height: 1.6; padding: 4px 0; opacity: 0.7;">
        AI-powered analysis and delivery insights will appear here once you load an issue.
      </div>
    `;
    el.metricCompletion.textContent = '--%';
    el.metricOpen.textContent = '--';
    el.metricBlocked.textContent = '--';
    el.metricHighest.textContent = '--';

    // Graph View Canvas Reset
    el.graphTotalNodes.textContent = '--';
    el.graphCriticalPath.textContent = '--';
    el.graphBlockedCount.textContent = '0 BLOCKED';
    el.graphBottlenecksList.innerHTML = '<p style="font-style:italic; font-size:11px; color:var(--on-surface-variant); text-align:center; padding: 12px 0;">No active bottlenecks.</p>';
    el.graphRiskPaths.innerHTML = '<p style="font-style:italic; font-size:11px; color:var(--on-surface-variant); text-align:center; padding: 12px 0;">No risk paths.</p>';
    
    // Clear graph nodes and connection canvas
    el.graphSvgConnections.innerHTML = '';
    const oldNodes = el.graphNodesWrapper.querySelectorAll('.graph-node');
    oldNodes.forEach(n => n.remove());
    
    // Add big centered empty state inside the graph container
    const oldBanners = el.graphNodesWrapper.querySelectorAll('.graph-empty-banner');
    oldBanners.forEach(b => b.remove());

    const graphPlaceholder = document.createElement('div');
    graphPlaceholder.className = 'empty-placeholder graph-empty-banner';
    graphPlaceholder.style.position = 'absolute';
    graphPlaceholder.style.left = '50%';
    graphPlaceholder.style.top = '50%';
    graphPlaceholder.style.transform = 'translate(-50%, -50%)';
    graphPlaceholder.style.width = '400px';
    graphPlaceholder.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 56px; color: var(--outline);">schema</span>
      <div class="empty-placeholder-title" style="font-size: 16px; margin-top: 8px;">Interactive Dependency Graph</div>
      <p class="empty-placeholder-desc" style="font-size: 12px; margin-top: 4px;">
        Visualise blockers, subtasks, critical paths, and bottleneck hops. Load an Epic hierarchy from the menu to build the graph.
      </p>
    `;
    el.graphNodesWrapper.appendChild(graphPlaceholder);
  }

  // --- FUTURISTIC GLOBAL LOADER UTILS ---
  let loaderAnimationId = null;

  function showLoader(statusText, mode) {
    const loader = document.getElementById('global-loader');
    const title = document.getElementById('loader-title');
    const status = document.getElementById('loader-status');
    if (loader) {
      if (mode === 'jira') {
        loader.classList.add('jira-mode');
        if (title) title.textContent = 'Jira Sync';
      } else {
        loader.classList.remove('jira-mode');
        if (title) title.textContent = 'Synapse';
      }
      if (status) status.textContent = statusText || 'Loading...';
      loader.style.display = 'flex';
      // Force reflow
      loader.offsetHeight;
      loader.classList.add('active');
      
      // Start constellation animation loop
      if (!loaderAnimationId) {
        animateLoaderConstellation();
      }
    }
  }

  function updateLoaderStatus(statusText) {
    const status = document.getElementById('loader-status');
    if (status) status.textContent = statusText;
  }

  function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.classList.remove('active');
      setTimeout(() => {
        loader.style.display = 'none';
        loaderAnimationId = null;
      }, 400); // Matches transition duration
    }
  }

  function animateLoaderConstellation() {
    const loader = document.getElementById('global-loader');
    if (!loader || loader.style.display === 'none') {
      loaderAnimationId = null;
      return;
    }
    
    const orbit1 = document.querySelector('.orbit-node-1');
    const orbit2 = document.querySelector('.orbit-node-2');
    const orbit3 = document.querySelector('.orbit-node-3');
    const line1 = document.querySelector('.line-1');
    const line2 = document.querySelector('.line-2');
    const line3 = document.querySelector('.line-3');
    
    if (orbit1 && line1) {
      const r1 = orbit1.getBoundingClientRect();
      const parent = orbit1.parentElement.getBoundingClientRect();
      const x = r1.left - parent.left + r1.width / 2;
      const y = r1.top - parent.top + r1.height / 2;
      line1.setAttribute('x2', x);
      line1.setAttribute('y2', y);
    }
    if (orbit2 && line2) {
      const r2 = orbit2.getBoundingClientRect();
      const parent = orbit2.parentElement.getBoundingClientRect();
      const x = r2.left - parent.left + r2.width / 2;
      const y = r2.top - parent.top + r2.height / 2;
      line2.setAttribute('x2', x);
      line2.setAttribute('y2', y);
    }
    if (orbit3 && line3) {
      const r3 = orbit3.getBoundingClientRect();
      const parent = orbit3.parentElement.getBoundingClientRect();
      const x = r3.left - parent.left + r3.width / 2;
      const y = r3.top - parent.top + r3.height / 2;
      line3.setAttribute('x2', x);
      line3.setAttribute('y2', y);
    }
    
    loaderAnimationId = requestAnimationFrame(animateLoaderConstellation);
  }

  // --- THEME MANAGEMENT ---
  function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      updateThemeIcon('dark');
    } else {
      document.documentElement.classList.remove('dark');
      updateThemeIcon('light');
    }

    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        const newTheme = isDark ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
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
})();
