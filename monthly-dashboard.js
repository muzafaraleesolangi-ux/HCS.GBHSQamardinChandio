/* Mobile-first monthly report overview. Existing report logic remains the source of truth. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const workspace = $('#workspace');
  const dashboard = $('#mpr-dashboard');
  const journey = $('#mpr-workflow-nav');
  if (!workspace || !dashboard || !journey) return;

  let snapshot = null;
  let stage = 'overview';
  const labelMonth = value => {
    if (!/^\d{4}-\d{2}$/.test(value || '')) return '';
    const [year, month] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en', {month: 'long', year: 'numeric'}).format(new Date(year, month - 1, 1));
  };
  const setText = (selector, value) => {
    const node = $(selector);
    if (node) node.textContent = value;
  };
  const initials = name => (name || 'Teacher').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
  const selectedClassCount = state => state.classes.length;

  function renderTeacherList(state) {
    const root = $('#md-teacher-list');
    root.replaceChildren();
    if (!state.teachers.length) {
      const empty = document.createElement('p');
      empty.className = 'md-empty';
      empty.textContent = 'No teachers added yet. Start with School setup.';
      root.append(empty);
      return;
    }
    const sorted = [...state.teachers].sort((a, b) => Number(a.complete) - Number(b.complete));
    for (const teacher of sorted.slice(0, 4)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'md-teacher-row';
      button.dataset.teacherId = teacher.id;
      const avatar = document.createElement('span');
      avatar.className = 'md-avatar';
      avatar.textContent = initials(teacher.name);
      const copy = document.createElement('span');
      copy.className = 'md-teacher-copy';
      const name = document.createElement('strong');
      name.textContent = teacher.name;
      const sub = document.createElement('small');
      sub.textContent = teacher.subjects
        ? teacher.completedSubjects + ' of ' + teacher.subjects + ' subjects complete'
        : 'Assign a subject to begin';
      copy.append(name, sub);
      const badge = document.createElement('span');
      badge.className = 'md-status ' + (teacher.complete ? 'is-ready' : '');
      badge.textContent = teacher.complete ? 'Ready' : 'In progress';
      const arrow = document.createElement('span');
      arrow.className = 'md-row-arrow';
      arrow.textContent = '›';
      button.append(avatar, copy, badge, arrow);
      root.append(button);
    }
  }

  function render(state) {
    if (!state) return;
    snapshot = state;
    const count = state.teachers.length;
    const ready = state.teachers.filter(teacher => teacher.complete).length;
    const percent = count ? Math.round(ready / count * 100) : 0;
    const assigned = selectedClassCount(state);
    const covered = state.coveredClasses;
    setText('#md-school', state.school);
    setText('#md-percent', percent + '%');
    setText('#md-ready-title', count ? ready + ' of ' + count + ' teachers ready' : 'Start your report');
    setText('#md-hero-hint', state.dirty
      ? 'Recent changes are saving. You can continue working.'
      : count ? (count - ready ? (count - ready) + ' teacher workspace' + (count - ready === 1 ? '' : 's') + ' still need attention.' : 'Teacher entries are complete. Review your final report.') : 'Set up your classes and teachers to begin.');
    setText('#md-teacher-stat', ready + ' / ' + count);
    setText('#md-teacher-hint', count ? ready + ' complete · ' + (count - ready) + ' in progress' : 'No teachers added');
    setText('#md-class-stat', covered + ' / ' + assigned);
    setText('#md-class-hint', assigned ? 'Selected classes with complete progress' : 'Choose your classes');
    setText('#md-attention-title', ready === count && count ? 'Teacher work complete' : 'Needs attention');
    setText('#md-final-hint', state.readyForFinal ? 'All required entries are complete. Ready to save and export.' : 'Complete school details, class subjects and teacher entries first.');
    $('.md-ring').style.setProperty('--progress', percent + '%');
    $('#md-teacher-meter').style.width = percent + '%';
    $('#md-month').value = state.month;
    const bars = $('#md-class-bars');
    bars.replaceChildren();
    const n = Math.max(assigned, 10);
    for (let index = 0; index < n; index++) {
      const bar = document.createElement('i');
      if (index < covered) bar.className = 'active';
      bars.append(bar);
    }
    renderTeacherList(state);
  }

  function open(stageName, teacherId) {
    if (!window.MPRApp?.snapshot()) return;
    stage = stageName;
    const overview = stageName === 'overview';
    workspace.classList.toggle('md-overview-active', overview);
    dashboard.hidden = !overview;
    journey.hidden = overview;
    if (!overview) {
      window.MPRApp.openStage(stageName, teacherId);
      const target = stageName === 'setup' ? $('#hm-setup') : stageName === 'final' ? $('#final-report-panel') : $('#teacher-tabs');
      if (target) requestAnimationFrame(() => target.scrollIntoView({behavior: 'smooth', block: 'start'}));
    } else {
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
    document.querySelectorAll('[data-md-stage]').forEach(button => button.classList.toggle('active', button.dataset.mdStage === stageName));
  }

  dashboard.addEventListener('click', event => {
    const teacher = event.target.closest('[data-teacher-id]');
    if (teacher) return open('teacher', teacher.dataset.teacherId);
    const button = event.target.closest('[data-md-stage]');
    if (button) open(button.dataset.mdStage);
  });
  journey.addEventListener('click', event => {
    const button = event.target.closest('[data-md-stage]');
    if (button) open(button.dataset.mdStage);
  });
  $('#md-continue').addEventListener('click', () => {
    if (!snapshot) return;
    if (!snapshot.classes.length || !snapshot.teachers.length) open('setup');
    else if (snapshot.teachers.some(teacher => !teacher.complete)) open('teacher');
    else open('final');
  });
  $('#md-month').addEventListener('change', event => {
    const value = event.target.value;
    if (!/^\d{4}-\d{2}$/.test(value) || value === window.MPRApp?.getMonth()) return;
    $('#report-month').value = value;
    $('#open-month').click();
  });
  $('#md-signout').addEventListener('click', () => $('#logout').click());
  window.addEventListener('mpr:state', event => {
    render(event.detail);
    if (event.detail && !workspace.dataset.dashboardStarted) {
      workspace.dataset.dashboardStarted = 'true';
      open('overview');
    }
  });
  // The report script may finish loading before this module attaches.
  const initial = window.MPRApp?.snapshot();
  if (initial) {
    render(initial);
    if (!workspace.dataset.dashboardStarted) {
      workspace.dataset.dashboardStarted = 'true';
      open('overview');
    }
  }
})();
