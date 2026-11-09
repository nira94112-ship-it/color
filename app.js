const API_BASE = '/api';
let isOwnerAuthenticated = false;
let authToken = sessionStorage.getItem('rohith_owner_token') || null;

const defaultPortfolioData = {
  home: {
    badge: 'PORTFOLIO',
    name: 'ROHITH',
    role: 'Developer & Creator',
    bio: 'Welcome to my official portfolio. Explore my skills, projects, and achievements below.'
  },
  about: {
    description: 'Hi, I am Rohith. Use the Owner Login button at the top right to customize your bio and add personal details here.',
    cards: []
  },
  skills: [],
  projects: [],
  achievements: [],
  contact: [],
  messages: []
};

let portfolioData = JSON.parse(JSON.stringify(defaultPortfolioData));

/* ==========================================================================
   INITIALIZATION & BACKEND SYNC
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  await loadPortfolioData();
  await verifyExistingSession();
  setupNavigationHighlight();
});

async function loadPortfolioData() {
  try {
    const res = await fetch(`${API_BASE}/portfolio`);
    if (res.ok) {
      portfolioData = await res.json();
      localStorage.setItem('rohith_portfolio_backup', JSON.stringify(portfolioData));
    } else {
      throw new Error('Backend offline');
    }
  } catch (err) {
    // Fallback to localStorage if opened directly without Node server
    const saved = localStorage.getItem('rohith_portfolio_backup');
    if (saved) {
      portfolioData = JSON.parse(saved);
    }
  }
  renderAllSections();
}

async function savePortfolioData() {
  localStorage.setItem('rohith_portfolio_backup', JSON.stringify(portfolioData));
  try {
    await fetch(`${API_BASE}/portfolio`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(portfolioData)
    });
  } catch (err) {
    // Saved locally when running serverless
  }
  renderAllSections();
}

/* ==========================================================================
   OWNER AUTHENTICATION (Controls visibility of Add/Edit Buttons)
   ========================================================================== */
async function verifyExistingSession() {
  if (!authToken) {
    setOwnerMode(false);
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/verify`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      setOwnerMode(true);
    } else if (authToken === 'local-owner-session') {
      setOwnerMode(true);
    } else {
      setOwnerMode(false);
    }
  } catch {
    if (authToken === 'local-owner-session') setOwnerMode(true);
  }
}

function setOwnerMode(enabled) {
  isOwnerAuthenticated = enabled;
  const ownerButtons = document.querySelectorAll('.owner-only-btn');
  const ownerBanner = document.getElementById('owner-banner');
  const statusDot = document.getElementById('auth-status-dot');
  const authBtnText = document.getElementById('auth-btn-text');
  const inboxPanel = document.getElementById('owner-inbox-panel');

  ownerButtons.forEach(btn => btn.classList.toggle('hidden', !enabled));
  ownerBanner.classList.toggle('hidden', !enabled);
  inboxPanel.classList.toggle('hidden', !enabled);

  if (enabled) {
    statusDot.classList.add('unlocked');
    authBtnText.textContent = 'Owner Unlocked';
  } else {
    statusDot.classList.remove('unlocked');
    authBtnText.textContent = 'Owner Login';
    sessionStorage.removeItem('rohith_owner_token');
    authToken = null;
  }
  renderAllSections();
}

// Toggle Login Modal
document.getElementById('auth-toggle-btn').addEventListener('click', () => {
  if (isOwnerAuthenticated) {
    setOwnerMode(false);
  } else {
    document.getElementById('owner-password').value = '';
    document.getElementById('login-error').classList.add('hidden');
    document.getElementById('login-modal').classList.remove('hidden');
  }
});

// Logout Button
document.getElementById('logout-btn').addEventListener('click', () => {
  setOwnerMode(false);
});

// Change Password Button
document.getElementById('change-pass-btn').addEventListener('click', async () => {
  const newPass = prompt('Enter new Owner Password (minimum 4 characters):');
  if (!newPass || newPass.trim().length < 4) return;

  localStorage.setItem('rohith_owner_password', newPass.trim());
  try {
    await fetch(`${API_BASE}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ newPassword: newPass.trim() })
    });
  } catch {}
  alert('Owner password updated successfully.');
});

// Handle Login Submit
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('owner-password').value;
  const errorEl = document.getElementById('login-error');

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      const data = await res.json();
      authToken = data.token;
      sessionStorage.setItem('rohith_owner_token', authToken);
      closeModals();
      setOwnerMode(true);
      return;
    } else {
      errorEl.classList.remove('hidden');
      return;
    }
  } catch {
    // Local fallback authentication (Default password: rohith123)
    const savedPass = localStorage.getItem('rohith_owner_password') || 'rohith123';
    if (password === savedPass) {
      authToken = 'local-owner-session';
      sessionStorage.setItem('rohith_owner_token', authToken);
      closeModals();
      setOwnerMode(true);
    } else {
      errorEl.classList.remove('hidden');
    }
  }
});

/* ==========================================================================
   RENDER ALL 6 SECTIONS
   ========================================================================== */
function renderAllSections() {
  renderHome();
  renderAbout();
  renderSkills();
  renderProjects();
  renderAchievements();
  renderContact();
  if (isOwnerAuthenticated) renderMessagesInbox();
}

function renderHome() {
  const { badge, name, role, bio } = portfolioData.home;
  document.getElementById('home-badge').textContent = badge || 'PORTFOLIO';
  document.getElementById('home-name').textContent = name || 'ROHITH';
  document.getElementById('nav-brand').textContent = name || 'ROHITH';
  document.getElementById('home-role').textContent = role || '';
  document.getElementById('home-bio').textContent = bio || '';
}

function renderAbout() {
  document.getElementById('about-description').textContent =
    portfolioData.about.description || 'No bio added yet.';

  const grid = document.getElementById('about-cards-grid');
  const cards = portfolioData.about.cards || [];

  if (cards.length === 0) {
    grid.innerHTML = `<div class="empty-state">No additional detail cards yet.</div>`;
    return;
  }

  grid.innerHTML = cards.map((item, idx) => `
    <div class="bento-card glass-panel">
      <div>
        <span class="card-tag">${escapeHtml(item.label)}</span>
        <h3 class="card-title">${escapeHtml(item.value)}</h3>
        ${item.subtext ? `<p class="card-desc">${escapeHtml(item.subtext)}</p>` : ''}
      </div>
      ${ownerCardControls('about', idx)}
    </div>
  `).join('');
}

function renderSkills() {
  const grid = document.getElementById('skills-grid');
  const items = portfolioData.skills || [];

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state">No skills added yet.</div>`;
    return;
  }

  grid.innerHTML = items.map((skill, idx) => `
    <div class="bento-card glass-panel">
      <div>
        <span class="card-tag">${escapeHtml(skill.category || 'SKILL')}</span>
        <h3 class="card-title">${escapeHtml(skill.name)}</h3>
        ${skill.level ? `
          <div class="skill-bar-track">
            <div class="skill-bar-fill" style="width: ${Math.min(100, Math.max(0, Number(skill.level)))}%"></div>
          </div>
        ` : ''}
      </div>
      ${ownerCardControls('skills', idx)}
    </div>
  `).join('');
}

function renderProjects() {
  const grid = document.getElementById('projects-grid');
  const items = portfolioData.projects || [];

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state">No projects added yet.</div>`;
    return;
  }

  grid.innerHTML = items.map((proj, idx) => `
    <div class="bento-card glass-panel">
      <div>
        ${proj.image ? `<img src="${escapeHtml(proj.image)}" alt="${escapeHtml(proj.title)}" class="project-thumb" />` : ''}
        <span class="card-tag">${escapeHtml(proj.category || 'PROJECT')}</span>
        <h3 class="card-title">${escapeHtml(proj.title)}</h3>
        <p class="card-desc">${escapeHtml(proj.description || '')}</p>
        ${proj.link ? `<a href="${escapeHtml(proj.link)}" target="_blank" rel="noopener" class="card-link">View Project →</a>` : ''}
      </div>
      ${ownerCardControls('projects', idx)}
    </div>
  `).join('');
}

function renderAchievements() {
  const grid = document.getElementById('achievements-grid');
  const items = portfolioData.achievements || [];

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state">No achievements added yet.</div>`;
    return;
  }

  grid.innerHTML = items.map((ach, idx) => `
    <div class="bento-card glass-panel">
      <div>
        <span class="card-tag">${escapeHtml(ach.year || '')} ${ach.organization ? `// ${escapeHtml(ach.organization)}` : ''}</span>
        <h3 class="card-title">${escapeHtml(ach.title)}</h3>
        <p class="card-desc">${escapeHtml(ach.description || '')}</p>
      </div>
      ${ownerCardControls('achievements', idx)}
    </div>
  `).join('');
}

function renderContact() {
  const grid = document.getElementById('contact-grid');
  const items = portfolioData.contact || [];

  if (items.length === 0) {
    grid.innerHTML = `<div class="empty-state">No contact details added yet.</div>`;
    return;
  }

  grid.innerHTML = items.map((info, idx) => `
    <div class="bento-card glass-panel">
      <div>
        <span class="card-tag">${escapeHtml(info.platform)}</span>
        <h3 class="card-title">${escapeHtml(info.value)}</h3>
        ${info.link ? `<a href="${escapeHtml(info.link)}" target="_blank" rel="noopener" class="card-link">Connect →</a>` : ''}
      </div>
      ${ownerCardControls('contact', idx)}
    </div>
  `).join('');
}

function ownerCardControls(section, index) {
  if (!isOwnerAuthenticated) return '';
  return `
    <div class="card-owner-controls">
      <button class="btn-card-edit" onclick="openItemModal('${section}', ${index})">✎ Edit</button>
      <button class="btn-card-delete" onclick="deleteSectionItem('${section}', ${index})">× Delete</button>
    </div>
  `;
}

/* ==========================================================================
   MODAL EDITORS FOR ALL SECTIONS (OWNER ONLY)
   ========================================================================== */
let currentEditorHandler = null;

function closeModals() {
  document.getElementById('login-modal').classList.add('hidden');
  document.getElementById('editor-modal').classList.add('hidden');
}

// 1. Edit Home Section
function openHomeModal() {
  if (!isOwnerAuthenticated) return;
  const { badge, name, role, bio } = portfolioData.home;

  document.getElementById('editor-modal-title').textContent = 'Edit Home Details';
  document.getElementById('editor-fields').innerHTML = `
    <div class="form-group">
      <label>Top Badge</label>
      <input type="text" id="field-badge" value="${escapeHtml(badge)}" required />
    </div>
    <div class="form-group">
      <label>Name</label>
      <input type="text" id="field-name" value="${escapeHtml(name)}" required />
    </div>
    <div class="form-group">
      <label>Role / Headline</label>
      <input type="text" id="field-role" value="${escapeHtml(role)}" />
    </div>
    <div class="form-group">
      <label>Short Intro</label>
      <textarea id="field-bio" rows="3">${escapeHtml(bio)}</textarea>
    </div>
  `;

  currentEditorHandler = async () => {
    portfolioData.home = {
      badge: document.getElementById('field-badge').value.trim(),
      name: document.getElementById('field-name').value.trim(),
      role: document.getElementById('field-role').value.trim(),
      bio: document.getElementById('field-bio').value.trim()
    };
    await savePortfolioData();
  };

  document.getElementById('editor-modal').classList.remove('hidden');
}

// 2. Edit About Me Main Bio
function openAboutTextModal() {
  if (!isOwnerAuthenticated) return;
  document.getElementById('editor-modal-title').textContent = 'Edit About Me Bio';
  document.getElementById('editor-fields').innerHTML = `
    <div class="form-group">
      <label>About Me Description</label>
      <textarea id="field-about-desc" rows="6" required>${escapeHtml(portfolioData.about.description)}</textarea>
    </div>
  `;

  currentEditorHandler = async () => {
    portfolioData.about.description = document.getElementById('field-about-desc').value.trim();
    await savePortfolioData();
  };

  document.getElementById('editor-modal').classList.remove('hidden');
}

// 3. Add / Edit Cards in About, Skills, Projects, Achievements, Contact
function openItemModal(section, editIndex = null) {
  if (!isOwnerAuthenticated) return;
  const isEdit = editIndex !== null;
  const fieldsContainer = document.getElementById('editor-fields');
  const titleEl = document.getElementById('editor-modal-title');

  if (section === 'about') {
    const item = isEdit ? portfolioData.about.cards[editIndex] : { label: '', value: '', subtext: '' };
    titleEl.textContent = isEdit ? 'Edit About Detail' : 'Add About Detail';
    fieldsContainer.innerHTML = `
      <div class="form-group">
        <label>Label (e.g. Education, Location, Experience)</label>
        <input type="text" id="f-label" value="${escapeHtml(item.label)}" required />
      </div>
      <div class="form-group">
        <label>Main Value / Title</label>
        <input type="text" id="f-value" value="${escapeHtml(item.value)}" required />
      </div>
      <div class="form-group">
        <label>Additional Info (Optional)</label>
        <input type="text" id="f-subtext" value="${escapeHtml(item.subtext || '')}" />
      </div>
    `;
    currentEditorHandler = async () => {
      const newItem = {
        label: document.getElementById('f-label').value.trim(),
        value: document.getElementById('f-value').value.trim(),
        subtext: document.getElementById('f-subtext').value.trim()
      };
      if (isEdit) portfolioData.about.cards[editIndex] = newItem;
      else portfolioData.about.cards.push(newItem);
      await savePortfolioData();
    };
  }

  else if (section === 'skills') {
    const item = isEdit ? portfolioData.skills[editIndex] : { name: '', category: '', level: '90' };
    titleEl.textContent = isEdit ? 'Edit Skill' : 'Add Skill';
    fieldsContainer.innerHTML = `
      <div class="form-group">
        <label>Skill Name</label>
        <input type="text" id="f-name" value="${escapeHtml(item.name)}" required />
      </div>
      <div class="form-group">
        <label>Category (e.g. Frontend, Backend, Tools)</label>
        <input type="text" id="f-cat" value="${escapeHtml(item.category)}" required />
      </div>
      <div class="form-group">
        <label>Proficiency % (1 - 100)</label>
        <input type="number" id="f-level" min="1" max="100" value="${escapeHtml(item.level)}" />
      </div>
    `;
    currentEditorHandler = async () => {
      const newItem = {
        name: document.getElementById('f-name').value.trim(),
        category: document.getElementById('f-cat').value.trim(),
        level: document.getElementById('f-level').value.trim()
      };
      if (isEdit) portfolioData.skills[editIndex] = newItem;
      else portfolioData.skills.push(newItem);
      await savePortfolioData();
    };
  }

  else if (section === 'projects') {
    const item = isEdit ? portfolioData.projects[editIndex] : { title: '', category: '', description: '', image: '', link: '' };
    titleEl.textContent = isEdit ? 'Edit Project' : 'Add Project';
    fieldsContainer.innerHTML = `
      <div class="form-group">
        <label>Project Title</label>
        <input type="text" id="f-title" value="${escapeHtml(item.title)}" required />
      </div>
      <div class="form-group">
        <label>Category / Tech Stack</label>
        <input type="text" id="f-cat" value="${escapeHtml(item.category)}" required />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="f-desc" rows="3" required>${escapeHtml(item.description)}</textarea>
      </div>
      <div class="form-group">
        <label>Image URL (Optional)</label>
        <input type="url" id="f-img" value="${escapeHtml(item.image || '')}" placeholder="https://..." />
      </div>
      <div class="form-group">
        <label>Project Link URL (Optional)</label>
        <input type="url" id="f-link" value="${escapeHtml(item.link || '')}" placeholder="https://..." />
      </div>
    `;
    currentEditorHandler = async () => {
      const newItem = {
        title: document.getElementById('f-title').value.trim(),
        category: document.getElementById('f-cat').value.trim(),
        description: document.getElementById('f-desc').value.trim(),
        image: document.getElementById('f-img').value.trim(),
        link: document.getElementById('f-link').value.trim()
      };
      if (isEdit) portfolioData.projects[editIndex] = newItem;
      else portfolioData.projects.push(newItem);
      await savePortfolioData();
    };
  }

  else if (section === 'achievements') {
    const item = isEdit ? portfolioData.achievements[editIndex] : { title: '', organization: '', year: '', description: '' };
    titleEl.textContent = isEdit ? 'Edit Achievement' : 'Add Achievement';
    fieldsContainer.innerHTML = `
      <div class="form-group">
        <label>Achievement Title</label>
        <input type="text" id="f-title" value="${escapeHtml(item.title)}" required />
      </div>
      <div class="form-group">
        <label>Organization / Event</label>
        <input type="text" id="f-org" value="${escapeHtml(item.organization)}" />
      </div>
      <div class="form-group">
        <label>Year / Date</label>
        <input type="text" id="f-year" value="${escapeHtml(item.year)}" />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="f-desc" rows="3">${escapeHtml(item.description)}</textarea>
      </div>
    `;
    currentEditorHandler = async () => {
      const newItem = {
        title: document.getElementById('f-title').value.trim(),
        organization: document.getElementById('f-org').value.trim(),
        year: document.getElementById('f-year').value.trim(),
        description: document.getElementById('f-desc').value.trim()
      };
      if (isEdit) portfolioData.achievements[editIndex] = newItem;
      else portfolioData.achievements.push(newItem);
      await savePortfolioData();
    };
  }

  else if (section === 'contact') {
    const item = isEdit ? portfolioData.contact[editIndex] : { platform: '', value: '', link: '' };
    titleEl.textContent = isEdit ? 'Edit Contact Detail' : 'Add Contact Detail';
    fieldsContainer.innerHTML = `
      <div class="form-group">
        <label>Label (e.g. Email, Phone, GitHub, LinkedIn)</label>
        <input type="text" id="f-platform" value="${escapeHtml(item.platform)}" required />
      </div>
      <div class="form-group">
        <label>Display Value (e.g. rohith@email.com)</label>
        <input type="text" id="f-value" value="${escapeHtml(item.value)}" required />
      </div>
      <div class="form-group">
        <label>Action Link (Optional, e.g. mailto:... or https://...)</label>
        <input type="text" id="f-link" value="${escapeHtml(item.link || '')}" />
      </div>
    `;
    currentEditorHandler = async () => {
      const newItem = {
        platform: document.getElementById('f-platform').value.trim(),
        value: document.getElementById('f-value').value.trim(),
        link: document.getElementById('f-link').value.trim()
      };
      if (isEdit) portfolioData.contact[editIndex] = newItem;
      else portfolioData.contact.push(newItem);
      await savePortfolioData();
    };
  }

  document.getElementById('editor-modal').classList.remove('hidden');
}

// Handle Editor Form Submission
document.getElementById('editor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (currentEditorHandler) {
    await currentEditorHandler();
    closeModals();
  }
});

// Delete Item from Any Section
async function deleteSectionItem(section, index) {
  if (!isOwnerAuthenticated) return;
  if (!confirm('Are you sure you want to delete this item?')) return;

  if (section === 'about') {
    portfolioData.about.cards.splice(index, 1);
  } else {
    portfolioData[section].splice(index, 1);
  }
  await savePortfolioData();
}

/* ==========================================================================
   CONTACT FORM & OWNER MESSAGE INBOX
   ========================================================================== */
document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newMsg = {
    name: document.getElementById('msg-name').value.trim(),
    email: document.getElementById('msg-email').value.trim(),
    body: document.getElementById('msg-body').value.trim(),
    date: new Date().toLocaleDateString()
  };

  portfolioData.messages = portfolioData.messages || [];
  portfolioData.messages.unshift(newMsg);

  try {
    await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg)
    });
  } catch {}

  localStorage.setItem('rohith_portfolio_backup', JSON.stringify(portfolioData));
  e.target.reset();

  const feedback = document.getElementById('form-feedback');
  feedback.textContent = 'Message sent successfully!';
  setTimeout(() => (feedback.textContent = ''), 4000);
  if (isOwnerAuthenticated) renderMessagesInbox();
});

function renderMessagesInbox() {
  const list = document.getElementById('messages-list');
  const msgs = portfolioData.messages || [];

  if (msgs.length === 0) {
    list.innerHTML = `<div class="empty-state">No messages received yet.</div>`;
    return;
  }

  list.innerHTML = msgs.map((m, idx) => `
    <div class="message-item">
      <div>
        <span class="card-tag">${escapeHtml(m.date)} // ${escapeHtml(m.email)}</span>
        <h4 class="card-title" style="font-size:1rem;">${escapeHtml(m.name)}</h4>
        <p class="card-desc">${escapeHtml(m.body)}</p>
      </div>
      <button class="btn-card-delete" onclick="deleteMessage(${idx})">×</button>
    </div>
  `).join('');
}

async function deleteMessage(index) {
  portfolioData.messages.splice(index, 1);
  await savePortfolioData();
}

/* ==========================================================================
   HELPERS & SCROLL SPY
   ========================================================================== */
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setupNavigationHighlight() {
  const sections = document.querySelectorAll('.section-block');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = 'home';
    sections.forEach(sec => {
      const top = sec.offsetTop - 180;
      if (window.scrollY >= top) current = sec.getAttribute('id');
    });
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
  });
}