let confirmCallback = null;
let currentEditId = null;
let currentReopenProjectId = null;
let timerInterval = null;
let timerSeconds = 0;
let startTime = null;
let inactivityTimer = null;
let lastActivityTime = Date.now();
let timerPaused = false;
let pausedSeconds = 0;
let windowIsVisible = true; // Rastrear se janela está visível
const INACTIVITY_TIMEOUT = 5 * 60 * 1000;

const subcategories = {
    'projeto': ['Horas Design', 'Documentação para Aprovação', 'Documentação para Fabrico', 'Documentação Técnica', 'Horas Aditamento', 'Horas de Não Conformidade'],
    'eletrico': ['Horas Design', 'Documentação para Aprovação', 'Documentação para Fabrico', 'Documentação Técnica', 'Horas Aditamento', 'Horas de Não Conformidade'],
    'desenvolvimento': [],     
    'orcamentacao': ['Orçamento', 'Ordem de produção']
};

function showConfirm(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = onConfirm;
    document.getElementById('confirmModal').classList.add('show');
}

function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('alertModal').classList.add('show');
}

document.getElementById('confirmYes').addEventListener('click', function() {
    document.getElementById('confirmModal').classList.remove('show');
    if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});

document.getElementById('confirmNo').addEventListener('click', function() {
    document.getElementById('confirmModal').classList.remove('show');
    confirmCallback = null;
});

document.getElementById('alertOk').addEventListener('click', function() {
    document.getElementById('alertModal').classList.remove('show');
});

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getProjects() {
    const projects = localStorage.getItem('projects_global');
    return projects ? JSON.parse(projects) : [];
}

function saveProjects(projects) {
    localStorage.setItem('projects_global', JSON.stringify(projects));
}

function getOpenProjects() { return getProjects().filter(p => p.status === 'open'); }
function getProjectByCode(code) { return getProjects().find(p => p.workCode === code); }
function getProjectById(id) { return getProjects().find(p => p.id == id); }

function getUsers() {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
}

function saveUsers(users) { localStorage.setItem('users', JSON.stringify(users)); }

function getWorkHistory() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const key = `workHistory_${user.username}`;
    const history = localStorage.getItem(key);
    return history ? JSON.parse(history) : [];
}

function getComments() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const key = `comments_${user.username}`;
    const comments = localStorage.getItem(key);
    return comments ? JSON.parse(comments) : {};
}

function saveComments(comments) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    localStorage.setItem(`comments_${user.username}`, JSON.stringify(comments));
}

function loadMeetingProjects(containerId, countId) {
    const openProjects = getOpenProjects();
    const container = document.getElementById(containerId);
    if (!container) return;
    if (openProjects.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 10px; font-size: 12px;">Sem obras abertas</p>';
        return;
    }
    container.innerHTML = openProjects.map(project => `
        <div class="checkbox-item">
            <label>
                <input type="checkbox" value="${project.id}" onchange="updateMeetingProjectsCount('${countId}', '${containerId}')">
                <span class="project-code-small">${project.workCode}</span>
                <span class="project-name-small">${project.name}</span>
            </label>
        </div>
    `).join('');
    updateMeetingProjectsCount(countId, containerId);
}

function updateMeetingProjectsCount(countId, containerId) {
    const container = document.getElementById(containerId);
    const countElement = document.getElementById(countId);
    if (!container || !countElement) return;
    const checkedCount = container.querySelectorAll('input[type="checkbox"]:checked').length;
    countElement.textContent = `${checkedCount} obra${checkedCount !== 1 ? 's' : ''} selecionada${checkedCount !== 1 ? 's' : ''}`;
}

function getSelectedMeetingProjects(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
    const projectIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    return projectIds.map(id => {
        const project = getProjectById(id);
        return project ? { id: project.id, workCode: project.workCode, name: project.name } : null;
    }).filter(p => p !== null);
}

function setSelectedMeetingProjects(containerId, projectIds) {
    const container = document.getElementById(containerId);
    if (!container || !projectIds) return;
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => { cb.checked = projectIds.includes(parseInt(cb.value)); });
}

function updateMeetingProjects() {
    const category = document.getElementById('internalCategory').value;
    const group = document.getElementById('meetingProjectsGroup');
    if (category === 'reuniao') {
        group.style.display = 'block';
        loadMeetingProjects('meetingProjectsList', 'meetingProjectsCount');
    } else {
        group.style.display = 'none';
    }
}

function updateEditMeetingProjects() {
    const category = document.getElementById('editInternalCategory').value;
    const group = document.getElementById('editMeetingProjectsGroup');
    if (category === 'reuniao') {
        group.style.display = 'block';
        loadMeetingProjects('editMeetingProjectsList', 'editMeetingProjectsCount');
    } else {
        group.style.display = 'none';
    }
}

function updateManualMeetingProjects() {
    const category = document.getElementById('manualInternalCategory').value;
    const group = document.getElementById('manualMeetingProjectsGroup');
    if (category === 'reuniao') {
        group.style.display = 'block';
        loadMeetingProjects('manualMeetingProjectsList', 'manualMeetingProjectsCount');
    } else {
        group.style.display = 'none';
    }
}

async function register() {
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const department = document.getElementById('regDepartment').value;
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');

    if (!firstName || !lastName || !username || !password) {
        errorDiv.textContent = 'Por favor, preencha todos os campos.';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (!department) {
        errorDiv.textContent = 'Por favor, selecione seu departamento padrão.';
        errorDiv.classList.remove('hidden');
        document.getElementById('regDepartment').focus();
        return;
    }
    if (username.length < 3) {
        errorDiv.textContent = 'O nome de utilizador deve ter pelo menos 3 caracteres.';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (password.length < 6) {
        errorDiv.textContent = 'A password deve ter pelo menos 6 caracteres.';
        errorDiv.classList.remove('hidden');
        return;
    }

    const users = getUsers();
    if (users.find(u => u.username === username)) {
        errorDiv.textContent = 'Este nome de utilizador já existe.';
        errorDiv.classList.remove('hidden');
        return;
    }

    const hashedPassword = await sha256(password);
    users.push({ firstName, lastName, username, password: hashedPassword, defaultDepartment: department, isAdmin: false });
    saveUsers(users);

    successDiv.textContent = 'Conta criada com sucesso! Pode fazer login.';
    successDiv.classList.remove('hidden');
    document.getElementById('regFirstName').value = '';
    document.getElementById('regLastName').value = '';
    document.getElementById('regDepartment').value = '';
    document.getElementById('regUsername').value = '';
    document.getElementById('regPassword').value = '';
    setTimeout(() => { showLogin(); }, 2000);
}

async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    errorDiv.classList.add('hidden');

    if (!username || !password) {
        errorDiv.textContent = 'Por favor, preencha todos os campos.';
        errorDiv.classList.remove('hidden');
        return;
    }

    const hashedPassword = await sha256(password);
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === hashedPassword);

    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        showApp();
    } else {
        errorDiv.textContent = 'Utilizador ou password incorretos.';
        errorDiv.classList.remove('hidden');
    }
}

function logout() {
    if (timerInterval) {
        showConfirm('Confirmar', 'Tem um timer ativo. Tem certeza que deseja sair?', function() {
            localStorage.removeItem('activeTimer');
            stopWork();
            localStorage.removeItem('currentUser');
            showLogin();
        });
    } else {
        localStorage.removeItem('currentUser');
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('registerScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('loginError').classList.add('hidden');
    
    const header = document.getElementById('mainHeader');
    if (header) {
        header.classList.remove('admin');
    }
    
    const adminBadge = document.getElementById('adminBadge');
    if (adminBadge) {
        adminBadge.classList.add('hidden');
    }
    
    const adminTabs = document.querySelectorAll('.admin-tab');
    adminTabs.forEach(tab => tab.classList.add('hidden'));
    
    setTimeout(() => document.getElementById('loginUsername').focus(), 100);
}

function showRegister() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('registerScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
    document.getElementById('registerError').classList.add('hidden');
    document.getElementById('registerSuccess').classList.add('hidden');
    
    const header = document.getElementById('mainHeader');
    if (header) {
        header.classList.remove('admin');
    }
    
    const adminBadge = document.getElementById('adminBadge');
    if (adminBadge) {
        adminBadge.classList.add('hidden');
    }
    
    const adminTabs = document.querySelectorAll('.admin-tab');
    adminTabs.forEach(tab => tab.classList.add('hidden'));
    
    setTimeout(() => document.getElementById('regFirstName').focus(), 100);
}

function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('registerScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    const user = JSON.parse(localStorage.getItem('currentUser'));
    document.getElementById('userName').textContent = `${user.firstName} ${user.lastName}`;
    if (user.defaultDepartment) {
        document.getElementById('projectType').value = user.defaultDepartment;
        updateSubcategories();
    }
    if (typeof setupAdminUI === 'function') { setupAdminUI(); }
    loadWorkHistory();
    updateStats();
    updateReports();
    updateExportStats();
    loadWorkSelectForComments();
    loadProjectSelects();
    loadProjectsList();
    startClock();
    resumeActiveTimer();
}


let clockInterval;
function startClock() {
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('currentTime').textContent = `${hours}:${minutes}:${seconds}`;
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    document.getElementById('currentDate').textContent = `${dayName}, ${day} de ${month} de ${year}`;
}

function updateWorkTypeFields() {
    const workType = document.querySelector('input[name="workType"]:checked').value;
    const projectFields = document.getElementById('projectFields');
    const internalFields = document.getElementById('internalFields');
    const workTimerDisplay = document.getElementById('workTimerDisplay');
    if (workType === 'internal') {
        projectFields.classList.add('hidden');
        internalFields.classList.remove('hidden');
        workTimerDisplay.classList.add('internal');
        updateMeetingProjects();
    } else {
        projectFields.classList.remove('hidden');
        internalFields.classList.add('hidden');
        workTimerDisplay.classList.remove('internal');
    }
}

function updateEditFields() {
    const workType = document.querySelector('input[name="editWorkType"]:checked').value;
    const projectFields = document.getElementById('editProjectFields');
    const internalFields = document.getElementById('editInternalFields');
    if (workType === 'internal') {
        projectFields.classList.add('hidden');
        internalFields.classList.remove('hidden');
        updateEditMeetingProjects();
    } else {
        projectFields.classList.remove('hidden');
        internalFields.classList.add('hidden');
    }
}

function updateManualFields() {
    const workType = document.querySelector('input[name="manualWorkType"]:checked').value;
    const projectFields = document.getElementById('manualProjectFields');
    const internalFields = document.getElementById('manualInternalFields');
    if (workType === 'internal') {
        projectFields.classList.add('hidden');
        internalFields.classList.remove('hidden');
        updateManualMeetingProjects();
    } else {
        projectFields.classList.remove('hidden');
        internalFields.classList.add('hidden');
    }
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
}

function formatHours(seconds) {
    const hours = (seconds / 3600).toFixed(1);
    return `${hours}h`;
}

function getDepartmentName(departmentCode) {
    const departments = { 'projeto': 'Projeto', 'eletrico': 'Elétrico', 'desenvolvimento': 'Desenvolvimento', 'orcamentacao': 'Orçamentação' };
    return departments[departmentCode] || departmentCode;
}

function getInternalCategoryName(categoryCode) {
    const categories = { 'reuniao': 'Reunião', 'formacao': 'Formação' };
    return categories[categoryCode] || categoryCode;
}

function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadProjectSelects() {
    const openProjects = getOpenProjects();
    const selects = [document.getElementById('projectSelect'), document.getElementById('editProjectSelect'), document.getElementById('manualProjectSelect')];
    selects.forEach(select => {
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">-- Selecione uma obra aberta --</option>';
            openProjects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = `${project.workCode} - ${project.name}`;
                select.appendChild(option);
            });
            if (currentValue) { select.value = currentValue; }
        }
    });
}

function updateProjectInfo() {
    const projectType = document.getElementById('projectType').value;
    if (projectType) { updateSubcategories(); }
}

function updateEditProjectInfo() {}
function updateManualProjectInfo() {}

function updateSubcategories() {
    const projectType = document.getElementById('projectType').value;
    const subcategoryGroup = document.getElementById('subcategoryGroup');
    const subcategorySelect = document.getElementById('subcategory');
    if (projectType && subcategories[projectType] && subcategories[projectType].length > 0) {
        subcategoryGroup.style.display = 'block';
        subcategorySelect.innerHTML = '<option value="">Selecione a subcategoria</option>';
        subcategories[projectType].forEach(sub => {
            subcategorySelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    } else {
        subcategoryGroup.style.display = 'none';
        subcategorySelect.value = '';
    }
}

function updateEditSubcategories() {
    const projectType = document.getElementById('editProjectType').value;
    const subcategoryGroup = document.getElementById('editSubcategoryGroup');
    const subcategorySelect = document.getElementById('editSubcategory');
    if (projectType && subcategories[projectType] && subcategories[projectType].length > 0) {
        subcategoryGroup.style.display = 'block';
        subcategorySelect.innerHTML = '<option value="">Selecione a subcategoria</option>';
        subcategories[projectType].forEach(sub => {
            subcategorySelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    } else {
        subcategoryGroup.style.display = 'none';
        subcategorySelect.value = '';
    }
}

function updateManualSubcategories() {
    const projectType = document.getElementById('manualProjectType').value;
    const subcategoryGroup = document.getElementById('manualSubcategoryGroup');
    const subcategorySelect = document.getElementById('manualSubcategory');
    if (projectType && subcategories[projectType] && subcategories[projectType].length > 0) {
        subcategoryGroup.style.display = 'block';
        subcategorySelect.innerHTML = '<option value="">Selecione a subcategoria</option>';
        subcategories[projectType].forEach(sub => {
            subcategorySelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    } else {
        subcategoryGroup.style.display = 'none';
        subcategorySelect.value = '';
    }
}

function startWork() {
    const workType = document.querySelector('input[name="workType"]:checked').value;
    const errorDiv = document.getElementById('timerError');
    errorDiv.classList.add('hidden');
    errorDiv.textContent = '';

    let validationPassed = false;
    let projectId = null;
    let projectType = null;

    if (workType === 'project') {
        projectId = document.getElementById('projectSelect').value;
        projectType = document.getElementById('projectType').value;
        if (!projectId) {
            errorDiv.textContent = '⚠️ Por favor, selecione uma obra antes de iniciar.';
            errorDiv.classList.remove('hidden');
            document.getElementById('projectSelect').focus();
            return;
        }
        if (!projectType) {
            errorDiv.textContent = '⚠️ Por favor, selecione o departamento antes de iniciar.';
            errorDiv.classList.remove('hidden');
            document.getElementById('projectType').focus();
            return;
        }
        validationPassed = true;
    } else {
        const internalDescription = document.getElementById('internalDescription').value.trim();
        if (!internalDescription) {
            errorDiv.textContent = '⚠️ Por favor, insira uma descrição para o trabalho interno.';
            errorDiv.classList.remove('hidden');
            document.getElementById('internalDescription').focus();
            return;
        }
        validationPassed = true;
    }

    if (!validationPassed) return;

    startTime = new Date();
    timerSeconds = 0;
    timerPaused = false;
    pausedSeconds = 0;

    const user = JSON.parse(localStorage.getItem('currentUser'));
    const timerState = { startTime: startTime.toISOString(), workType: workType, username: user.username };

    if (workType === 'project') {
        timerState.projectId = projectId;
        timerState.projectType = projectType;
        timerState.subcategory = document.getElementById('subcategory').value || '';
    } else {
        timerState.internalCategory = document.getElementById('internalCategory').value;
        timerState.internalDescription = document.getElementById('internalDescription').value;
        if (timerState.internalCategory === 'reuniao') {
            timerState.relatedProjects = getSelectedMeetingProjects('meetingProjectsList');
        }
    }

    localStorage.setItem('activeTimer', JSON.stringify(timerState));

    document.getElementById('startBtn').classList.add('hidden');
    document.getElementById('stopBtn').classList.remove('hidden');
    document.getElementById('timerStatus').textContent = 'Em trabalho...';
    document.getElementById('timerStatus').classList.add('active');

    if (workType === 'project') {
        document.getElementById('projectSelect').disabled = true;
        document.getElementById('projectType').disabled = true;
    } else {
        document.getElementById('internalCategory').disabled = true;
        document.getElementById('internalDescription').disabled = true;
    }
    document.querySelectorAll('input[name="workType"]').forEach(radio => radio.disabled = true);

    document.getElementById('floatingTimer').classList.remove('hidden');
    if (workType === 'internal') {
        document.getElementById('floatingTimer').classList.add('internal');
    }

    timerInterval = setInterval(() => {
        if (!timerPaused) {
            timerSeconds++;
            updateTimerDisplay();
        }
    }, 1000);

    startInactivityMonitor();
    updateHoursCounter(); 
}

function stopWork() {
    if (!timerInterval) return;
    clearInterval(timerInterval);
    timerInterval = null;
    stopInactivityMonitor();
    const endTime = new Date();
    const duration = timerSeconds;
    saveWorkSession(startTime, endTime, duration);
    localStorage.removeItem('activeTimer');
    updateHoursCounter();

    document.getElementById('startBtn').classList.remove('hidden');
    document.getElementById('stopBtn').classList.add('hidden');
    document.getElementById('timerStatus').textContent = 'Parado';
    document.getElementById('timerStatus').classList.remove('active');

    const workType = document.querySelector('input[name="workType"]:checked').value;
    if (workType === 'project') {
        document.getElementById('projectSelect').disabled = false;
        document.getElementById('projectType').disabled = false;
    } else {
        document.getElementById('internalCategory').disabled = false;
        document.getElementById('internalDescription').disabled = false;
    }
    document.querySelectorAll('input[name="workType"]').forEach(radio => radio.disabled = false);

    document.getElementById('floatingTimer').classList.add('hidden');
    document.getElementById('floatingTimer').classList.remove('internal');
    document.getElementById('workTimerDisplay').classList.remove('internal');

    timerSeconds = 0;
    timerPaused = false;
    pausedSeconds = 0;
    updateTimerDisplay();

    if (workType === 'project') {
        document.getElementById('projectSelect').value = '';
        document.getElementById('projectType').value = '';
    } else {
        document.getElementById('internalDescription').value = '';
    }

    loadWorkHistory();
    updateStats();
    loadWorkSelectForComments();
}

function updateTimerDisplay() {
    const hours = Math.floor(timerSeconds / 3600);
    const minutes = Math.floor((timerSeconds % 3600) / 60);
    const seconds = timerSeconds % 60;
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('workTimer').textContent = timeString;
    const floatTime = document.querySelector('.float-time');
    const floatStatus = document.querySelector('.float-status');
    if (floatTime && floatStatus) {
        floatTime.textContent = timeString;
        const workType = document.querySelector('input[name="workType"]:checked').value;
        if (workType === 'project') {
            const projectSelect = document.getElementById('projectSelect');
            if (projectSelect && projectSelect.value) {
                const project = getProjects().find(p => p.id == projectSelect.value);
                if (project) { floatStatus.textContent = project.workCode; }
            }
        } else {
            const internalCategory = document.getElementById('internalCategory');
            if (internalCategory && internalCategory.selectedIndex >= 0) {
                floatStatus.textContent = internalCategory.options[internalCategory.selectedIndex].text;
            }
        }
    }
}

function saveWorkSession(startTime, endTime, duration, comment = '') {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const workType = document.querySelector('input[name="workType"]:checked').value;
    const session = { id: Date.now(), userName: `${user.firstName} ${user.lastName}`, workType: workType, startTime: startTime.toISOString(), endTime: endTime.toISOString(), duration, comment: comment };

    if (workType === 'project') {
        const projectId = document.getElementById('projectSelect').value;
        const project = getProjects().find(p => p.id == projectId);
        const projectType = document.getElementById('projectType').value;
        if (project) {
            session.projectId = project.id;
            session.projectType = projectType;
            session.projectName = getDepartmentName(projectType);
            session.workCode = project.workCode;
            session.workName = project.name;
            session.subcategory = document.getElementById('subcategory').value || '';
        }
    } else {
        const internalCategory = document.getElementById('internalCategory').value;
        session.internalCategory = internalCategory;
        session.internalCategoryName = getInternalCategoryName(internalCategory);
        session.internalDescription = document.getElementById('internalDescription').value;
        if (internalCategory === 'reuniao') {
            session.relatedProjects = getSelectedMeetingProjects('meetingProjectsList');
        }
    }

    const history = getWorkHistory();
    history.unshift(session);
    const key = `workHistory_${user.username}`;
    localStorage.setItem(key, JSON.stringify(history));
}

function resumeActiveTimer() {
    const timerState = localStorage.getItem('activeTimer');
    if (!timerState) return;
    const state = JSON.parse(timerState);
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (state.username !== user.username) return;

    startTime = new Date(state.startTime);
    const now = new Date();
    timerSeconds = Math.floor((now - startTime) / 1000);

    if (state.workType === 'internal') {
        document.getElementById('workTypeInternal').checked = true;
        updateWorkTypeFields();
        document.getElementById('internalCategory').value = state.internalCategory || 'reuniao';
        updateMeetingProjects();
        if (state.relatedProjects && state.relatedProjects.length > 0) {
            const projectIds = state.relatedProjects.map(p => p.id);
            setSelectedMeetingProjects('meetingProjectsList', projectIds);
        }
        document.getElementById('internalDescription').value = state.internalDescription || '';
    } else {
        document.getElementById('workTypeProject').checked = true;
        updateWorkTypeFields();
        document.getElementById('projectSelect').value = state.projectId || '';
        document.getElementById('projectType').value = state.projectType || '';
        updateSubcategories();
        if (state.subcategory) {
            document.getElementById('subcategory').value = state.subcategory;
        }
    }

    document.getElementById('startBtn').classList.add('hidden');
    document.getElementById('stopBtn').classList.remove('hidden');
    document.getElementById('timerStatus').textContent = 'Em trabalho...';
    document.getElementById('timerStatus').classList.add('active');

    if (state.workType === 'internal') {
        document.getElementById('internalCategory').disabled = true;
        document.getElementById('internalDescription').disabled = true;
    } else {
        document.getElementById('projectSelect').disabled = true;
        document.getElementById('projectType').disabled = true;
    }
    document.querySelectorAll('input[name="workType"]').forEach(radio => radio.disabled = true);

    document.getElementById('floatingTimer').classList.remove('hidden');
    if (state.workType === 'internal') {
        document.getElementById('floatingTimer').classList.add('internal');
        document.getElementById('workTimerDisplay').classList.add('internal');
    }

    updateTimerDisplay();
    timerPaused = false;
    timerInterval = setInterval(() => {
        if (!timerPaused) {
            timerSeconds++;
            updateTimerDisplay();
        }
    }, 1000);
    startInactivityMonitor();
}

function resetActivityTimer() { lastActivityTime = Date.now(); }

// Recalcular timer baseado no tempo real (não em incrementos)
function recalculateTimerFromStartTime() {
    if (!timerInterval || !startTime) return;
    
    const now = new Date();
    timerSeconds = Math.floor((now - startTime) / 1000);
    updateTimerDisplay();
}

function startInactivityMonitor() {
    lastActivityTime = Date.now();
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => { document.addEventListener(event, resetActivityTimer); });
    inactivityTimer = setInterval(checkInactivity, 10000);
}

function stopInactivityMonitor() {
    if (inactivityTimer) {
        clearInterval(inactivityTimer);
        inactivityTimer = null;
    }
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => { document.removeEventListener(event, resetActivityTimer); });
}

function checkInactivity() {
    // NÃO detetar inatividade se a janela estiver minimizada/escondida
    if (!windowIsVisible) {
        return;
    }
    
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;
    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT && !timerPaused && timerInterval) {
        pauseTimerForInactivity();
    }
    if (timerPaused) { updatePausedDuration(); }
}

function pauseTimerForInactivity() {
    timerPaused = true;
    pausedSeconds = 0;
    document.getElementById('inactivityModal').classList.add('show');
    document.getElementById('timerStatus').textContent = 'Pausado (Inatividade)';
    document.getElementById('timerStatus').classList.remove('active');
    const minutes = Math.floor(INACTIVITY_TIMEOUT / 60000);
    document.getElementById('inactivityTime').textContent = `${minutes} minutos`;
}

function updatePausedDuration() {
    pausedSeconds++;
    const minutes = Math.floor(pausedSeconds / 60);
    const seconds = pausedSeconds % 60;
    document.getElementById('pausedDuration').textContent = `${minutes}m ${seconds}s`;
}

function resumeTimer() {
    timerPaused = false;
    lastActivityTime = Date.now();
    document.getElementById('inactivityModal').classList.remove('show');
    document.getElementById('timerStatus').textContent = 'Em trabalho...';
    document.getElementById('timerStatus').classList.add('active');
    pausedSeconds = 0;
}

function stopWorkFromInactivity() {
    localStorage.removeItem('activeTimer');
    document.getElementById('inactivityModal').classList.remove('show');
    stopWork();
}

function loadWorkHistory() {
    const history = getWorkHistory();
    const container = document.getElementById('workHistory');
    if (history.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem histórico de trabalho</p>';
        return;
    }
    
    // Aplicar filtro de pesquisa se existir
    const searchInput = document.getElementById('historySearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    let filteredHistory = history;
    if (searchTerm) {
        filteredHistory = history.filter(session => {
            const workCode = (session.workCode || '').toLowerCase();
            const workName = (session.workName || '').toLowerCase();
            const description = (session.internalDescription || '').toLowerCase();
            const comment = (session.comment || '').toLowerCase();
            return workCode.includes(searchTerm) || workName.includes(searchTerm) || 
                   description.includes(searchTerm) || comment.includes(searchTerm);
        });
    }
    
    if (filteredHistory.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Nenhum resultado encontrado</p>';
        return;
    }
    
    container.innerHTML = filteredHistory.slice(0, 10).map(session => {
        const date = new Date(session.startTime);
        const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const commentHtml = session.comment ? `<div class="hist-comment">💬 ${session.comment}</div>` : '';
        let badgesHtml = '';
        if (session.workType === 'internal') { badgesHtml += '<span class="hist-badge badge-internal">🏠 Interno</span>'; }
        if (session.manualEntry) { badgesHtml += '<span class="hist-badge badge-manual">📝 Inserido Manualmente</span>'; }
        if (session.manualEdit) { badgesHtml += '<span class="hist-badge badge-edited">✏️ Editado Manualmente</span>'; }
        let mainInfo = '';
        let subInfo = '';
        if (session.workType === 'internal') {
            mainInfo = session.internalCategoryName || 'Trabalho Interno';
            subInfo = `<div class="hist-obra">📝 ${session.internalDescription || ''}</div>`;
            if (session.relatedProjects && session.relatedProjects.length > 0) {
                const projectsList = session.relatedProjects.map(p => p.workCode).join(', ');
                subInfo += `<div class="hist-obra">🏗️ Obras: ${projectsList}</div>`;
            }
        } else {
            mainInfo = session.projectName;
            const workNameHtml = session.workName ? `<div class="hist-obra">📋 ${session.workCode} - ${session.workName}</div>` : `<div class="hist-obra">📋 ${session.workCode}</div>`;
            const subcategoryHtml = session.subcategory ? `<div class="hist-obra">🏷️ ${session.subcategory}</div>` : '';
            subInfo = `${subcategoryHtml}${workNameHtml}`;
        }
        const itemClass = session.workType === 'internal' ? 'history-item internal' : 'history-item';
        return `
            <div class="${itemClass}">
                <div class="hist-project">${mainInfo} ${badgesHtml}</div>
                ${subInfo}
                <div class="hist-time">⏱️ ${formatDuration(session.duration)}</div>
                <div class="hist-date">${dateStr}</div>
                ${commentHtml}
                <div class="hist-actions">
                    <button class="btn btn-primary btn-small" onclick="editSession(${session.id})">✏️ Editar</button>
                    <button class="btn btn-success btn-small" onclick="duplicateSession(${session.id})">📋 Duplicar</button>
                    <button class="btn btn-warning btn-small" onclick="openComments(${session.id})">💬 Comentário</button>
                    <button class="btn btn-danger btn-small" onclick="deleteSession(${session.id})">🗑️ Apagar</button>
                </div>
            </div>
        `;
    }).join('');
}

// Filtrar histórico por pesquisa
function filterWorkHistory() {
    loadWorkHistory();
}

function editSession(sessionId) {
    const history = getWorkHistory();
    const session = history.find(s => s.id === sessionId);
    if (!session) return;
    currentEditId = sessionId;
    loadProjectSelects();
    if (session.workType === 'internal') {
        document.getElementById('editWorkTypeInternal').checked = true;
        updateEditFields();
        document.getElementById('editInternalCategory').value = session.internalCategory || 'reuniao';
        updateEditMeetingProjects();
        if (session.relatedProjects && session.relatedProjects.length > 0) {
            const projectIds = session.relatedProjects.map(p => p.id);
            setSelectedMeetingProjects('editMeetingProjectsList', projectIds);
        }
        document.getElementById('editInternalDescription').value = session.internalDescription || '';
    } else {
        document.getElementById('editWorkTypeProject').checked = true;
        updateEditFields();
        if (session.projectId) {
            document.getElementById('editProjectSelect').value = session.projectId;
        } else {
            const project = getProjects().find(p => p.workCode === session.workCode);
            if (project) { document.getElementById('editProjectSelect').value = project.id; }
        }
        if (session.projectType) {
            document.getElementById('editProjectType').value = session.projectType;
            updateEditSubcategories();
        }
        if (session.subcategory) {
            document.getElementById('editSubcategory').value = session.subcategory;
        }
    }
    const startDate = new Date(session.startTime);
    const endDate = new Date(session.endTime);
    document.getElementById('editStartTime').value = formatDateTimeLocal(startDate);
    document.getElementById('editEndTime').value = formatDateTimeLocal(endDate);
    document.getElementById('editComment').value = session.comment || '';
    document.getElementById('editModal').classList.add('show');
}

function saveEdit() {
    if (!currentEditId) return;
    const errorDiv = document.getElementById('editError');
    const successDiv = document.getElementById('editSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    const workType = document.querySelector('input[name="editWorkType"]:checked').value;
    const startTime = new Date(document.getElementById('editStartTime').value);
    const endTime = new Date(document.getElementById('editEndTime').value);
    const comment = document.getElementById('editComment').value.trim();
    if (!startTime || !endTime) {
        errorDiv.textContent = '⚠️ Por favor, preencha todos os campos obrigatórios.';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (endTime <= startTime) {
        errorDiv.textContent = '⚠️ A hora de fim deve ser posterior à hora de início.';
        errorDiv.classList.remove('hidden');
        return;
    }
    let validationPassed = false;
    if (workType === 'project') {
        const projectId = document.getElementById('editProjectSelect').value;
        const projectType = document.getElementById('editProjectType').value;
        if (!projectId) {
            errorDiv.textContent = '⚠️ Por favor, selecione uma obra.';
            errorDiv.classList.remove('hidden');
            return;
        }
        if (!projectType) {
            errorDiv.textContent = '⚠️ Por favor, selecione o departamento.';
            errorDiv.classList.remove('hidden');
            return;
        }
        validationPassed = true;
    } else {
        const internalDescription = document.getElementById('editInternalDescription').value.trim();
        if (!internalDescription) {
            errorDiv.textContent = '⚠️ Por favor, preencha a descrição.';
            errorDiv.classList.remove('hidden');
            return;
        }
        validationPassed = true;
    }
    if (!validationPassed) return;
    const duration = Math.floor((endTime - startTime) / 1000);
    const history = getWorkHistory();
    const sessionIndex = history.findIndex(s => s.id === currentEditId);
    if (sessionIndex !== -1) {
        history[sessionIndex].workType = workType;
        history[sessionIndex].startTime = startTime.toISOString();
        history[sessionIndex].endTime = endTime.toISOString();
        history[sessionIndex].duration = duration;
        history[sessionIndex].comment = comment;
        history[sessionIndex].manualEdit = true;
        if (workType === 'project') {
            const projectId = document.getElementById('editProjectSelect').value;
            const project = getProjects().find(p => p.id == projectId);
            const projectType = document.getElementById('editProjectType').value;
            if (project) {
                history[sessionIndex].projectId = project.id;
                history[sessionIndex].projectType = projectType;
                history[sessionIndex].projectName = getDepartmentName(projectType);
                history[sessionIndex].workCode = project.workCode;
                history[sessionIndex].workName = project.name;
                history[sessionIndex].subcategory = document.getElementById('editSubcategory').value || '';
            }
            delete history[sessionIndex].internalCategory;
            delete history[sessionIndex].internalCategoryName;
            delete history[sessionIndex].internalDescription;
            delete history[sessionIndex].relatedProjects;
        } else {
            const internalCategory = document.getElementById('editInternalCategory').value;
            history[sessionIndex].internalCategory = internalCategory;
            history[sessionIndex].internalCategoryName = getInternalCategoryName(internalCategory);
            history[sessionIndex].internalDescription = document.getElementById('editInternalDescription').value;
            if (internalCategory === 'reuniao') {
                history[sessionIndex].relatedProjects = getSelectedMeetingProjects('editMeetingProjectsList');
            } else {
                delete history[sessionIndex].relatedProjects;
            }
            delete history[sessionIndex].projectId;
            delete history[sessionIndex].projectType;
            delete history[sessionIndex].projectName;
            delete history[sessionIndex].workCode;
            delete history[sessionIndex].workName;
            delete history[sessionIndex].subcategory;
        }
        const user = JSON.parse(localStorage.getItem('currentUser'));
        const key = `workHistory_${user.username}`;
        localStorage.setItem(key, JSON.stringify(history));
        successDiv.textContent = '✅ Sessão atualizada com sucesso!';
        successDiv.classList.remove('hidden');
        setTimeout(() => {
            closeEditModal();
            loadWorkHistory();
            updateStats();
            updateReports();
        }, 1500);
    }
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    currentEditId = null;
}

function openManualEntry() {
    document.getElementById('manualWorkTypeProject').checked = true;
    updateManualFields();
    loadProjectSelects();
    const now = new Date();
    document.getElementById('manualStartTime').value = formatDateTimeLocal(now);
    document.getElementById('manualEndTime').value = formatDateTimeLocal(now);
    document.getElementById('manualError').classList.add('hidden');
    document.getElementById('manualSuccess').classList.add('hidden');
    document.getElementById('manualEntryModal').classList.add('show');
}

function closeManualEntryModal() {
    document.getElementById('manualEntryModal').classList.remove('show');
    document.getElementById('manualProjectSelect').value = '';
    document.getElementById('manualProjectType').value = '';
    document.getElementById('manualInternalCategory').value = 'reuniao';
    document.getElementById('manualInternalDescription').value = '';
    document.getElementById('manualStartTime').value = '';
    document.getElementById('manualEndTime').value = '';
    document.getElementById('manualComment').value = '';
    document.getElementById('manualSubcategory').value = '';
    document.getElementById('manualSubcategoryGroup').style.display = 'none';
}

function saveManualEntry() {
    const errorDiv = document.getElementById('manualError');
    const successDiv = document.getElementById('manualSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    const workType = document.querySelector('input[name="manualWorkType"]:checked').value;
    const startTime = new Date(document.getElementById('manualStartTime').value);
    const endTime = new Date(document.getElementById('manualEndTime').value);
    const comment = document.getElementById('manualComment').value.trim();
    if (!startTime || !endTime) {
        errorDiv.textContent = '⚠️ Por favor, preencha as datas de início e fim.';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (endTime <= startTime) {
        errorDiv.textContent = '⚠️ A hora de fim deve ser posterior à hora de início.';
        errorDiv.classList.remove('hidden');
        return;
    }
    let validationPassed = false;
    const duration = Math.floor((endTime - startTime) / 1000);
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const session = { id: Date.now(), userName: `${user.firstName} ${user.lastName}`, workType: workType, startTime: startTime.toISOString(), endTime: endTime.toISOString(), duration, comment: comment, manualEntry: true };
    if (workType === 'project') {
        const projectId = document.getElementById('manualProjectSelect').value;
        const projectType = document.getElementById('manualProjectType').value;
        const subcategory = document.getElementById('manualSubcategory').value || '';
        if (!projectId) {
            errorDiv.textContent = '⚠️ Por favor, selecione uma obra.';
            errorDiv.classList.remove('hidden');
            return;
        }
        if (!projectType) {
            errorDiv.textContent = '⚠️ Por favor, selecione o departamento.';
            errorDiv.classList.remove('hidden');
            return;
        }
        const project = getProjects().find(p => p.id == projectId);
        if (project) {
            session.projectId = project.id;
            session.projectType = projectType;
            session.projectName = getDepartmentName(projectType);
            session.workCode = project.workCode;
            session.workName = project.name;
            session.subcategory = subcategory;
        }
        validationPassed = true;
    } else {
        const internalCategory = document.getElementById('manualInternalCategory').value;
        const internalDescription = document.getElementById('manualInternalDescription').value.trim();
        if (!internalDescription) {
            errorDiv.textContent = '⚠️ Por favor, insira uma descrição para o trabalho interno.';
            errorDiv.classList.remove('hidden');
            return;
        }
        session.internalCategory = internalCategory;
        session.internalCategoryName = getInternalCategoryName(internalCategory);
        session.internalDescription = internalDescription;
        if (internalCategory === 'reuniao') {
            session.relatedProjects = getSelectedMeetingProjects('manualMeetingProjectsList');
        }
        validationPassed = true;
    }
    if (!validationPassed) return;
    const history = getWorkHistory();
    history.unshift(session);
    const key = `workHistory_${user.username}`;
    localStorage.setItem(key, JSON.stringify(history));
    successDiv.textContent = '✅ Sessão adicionada com sucesso!';
    successDiv.classList.remove('hidden');
    setTimeout(() => {
        closeManualEntryModal();
        loadWorkHistory();
        updateStats();
        updateReports();
    }, 1500);
}

function deleteSession(sessionId) {
    const history = getWorkHistory();
    const session = history.find(s => s.id === sessionId);
    if (!session) return;
    const newHistory = history.filter(s => s.id !== sessionId);
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const key = `workHistory_${user.username}`;
    localStorage.setItem(key, JSON.stringify(newHistory));
    const allComments = getComments();
    if (allComments[sessionId]) {
        delete allComments[sessionId];
        saveComments(allComments);
    }
    loadWorkHistory();
    updateStats();
    updateReports();
    loadWorkSelectForComments();
}

function openNewProjectModal() {
    document.getElementById('newProjectError').classList.add('hidden');
    document.getElementById('newProjectSuccess').classList.add('hidden');
    document.getElementById('newProjectModal').classList.add('show');
    setTimeout(() => document.getElementById('newProjectCode').focus(), 100);
}

function closeNewProjectModal() {
    document.getElementById('newProjectModal').classList.remove('show');
    document.getElementById('newProjectCode').value = '';
    document.getElementById('newProjectName').value = '';
    document.getElementById('newProjectNotes').value = '';
}

function createNewProject() {
    const errorDiv = document.getElementById('newProjectError');
    const successDiv = document.getElementById('newProjectSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    const workCode = document.getElementById('newProjectCode').value.trim();
    const name = document.getElementById('newProjectName').value.trim();
    const notes = document.getElementById('newProjectNotes').value.trim();
    if (!workCode || !name) {
        errorDiv.textContent = '⚠️ Por favor, preencha todos os campos obrigatórios.';
        errorDiv.classList.remove('hidden');
        return;
    }
    if (workCode.length < 5) {
        errorDiv.textContent = '⚠️ Código da obra inválido! Deve ter pelo menos 5 caracteres.';
        errorDiv.classList.remove('hidden');
        document.getElementById('newProjectCode').focus();
        return;
    }
    const projects = getProjects();
    if (projects.find(p => p.workCode === workCode)) {
        errorDiv.textContent = '⚠️ Já existe uma obra com este código.';
        errorDiv.classList.remove('hidden');
        return;
    }
    const newProject = { id: Date.now(), workCode: workCode, name: name, status: 'open', createdDate: new Date().toISOString(), notes: notes, reopenHistory: [] };
    projects.push(newProject);
    saveProjects(projects);
    successDiv.textContent = '✅ Obra criada com sucesso!';
    successDiv.classList.remove('hidden');
    setTimeout(() => {
        closeNewProjectModal();
        loadProjectsList();
        loadProjectSelects();
    }, 1500);
}

function loadProjectsList() {
    const statusFilter = document.getElementById('projectStatusFilter').value;
    const projects = getProjects();
    const container = document.getElementById('projectsList');
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const isAdmin = user && user.isAdmin === true;
    
    updateProjectsStats(projects);
    
    let filteredProjects = projects;
    if (statusFilter === 'open') { filteredProjects = projects.filter(p => p.status === 'open'); }
    else if (statusFilter === 'closed') { filteredProjects = projects.filter(p => p.status === 'closed'); }
    if (filteredProjects.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem obras para mostrar</p>';
        return;
    }
    container.innerHTML = filteredProjects.map(project => {
        const createdDate = new Date(project.createdDate);
        const createdStr = `${createdDate.getDate()}/${createdDate.getMonth() + 1}/${createdDate.getFullYear()}`;
        let closedStr = '';
        if (project.closedDate) {
            const closedDate = new Date(project.closedDate);
            closedStr = `${closedDate.getDate()}/${closedDate.getMonth() + 1}/${closedDate.getFullYear()}`;
        }
        const statusClass = project.status === 'open' ? 'status-open' : 'status-closed';
        const statusText = project.status === 'open' ? 'Aberta' : 'Fechada';
        const cardClass = project.status === 'closed' ? 'project-card closed' : 'project-card';
        let reopenInfoHtml = '';
        if (project.reopenHistory && project.reopenHistory.length > 0) {
            const lastReopen = project.reopenHistory[project.reopenHistory.length - 1];
            const reopenDate = new Date(lastReopen.date);
            const reopenDateStr = `${reopenDate.getDate()}/${reopenDate.getMonth() + 1}/${reopenDate.getFullYear()}`;
            const reasonText = lastReopen.reason === 'client_change' ? 'Alteração do Cliente' : 'Erro Nosso';
            const reasonColor = lastReopen.reason === 'client_change' ? '#f39c12' : '#e74c3c';
            const reopenCount = project.reopenHistory.length;
            const reopenLabel = reopenCount > 1 ? `(${reopenCount}x reabertas)` : '';
            reopenInfoHtml = `<div class="reopen-info" style="border-color: ${reasonColor};"><strong>🔄 Reaberta ${reopenLabel}:</strong> ${reopenDateStr} - <span style="color: ${reasonColor}; font-weight: 600;">${reasonText}</span>${lastReopen.comment ? `<br><em>${lastReopen.comment}</em>` : ''}</div>`;
        }
        
        let actionsHtml = '';
        if (isAdmin) {
            actionsHtml = project.status === 'open' 
                ? `<button class="btn btn-danger btn-small" onclick="closeProject(${project.id})">🔒 Terminar Obra</button>` 
                : `<button class="btn btn-warning btn-small" onclick="openReopenProjectModal(${project.id})">🔄 Reabrir Obra</button>`;
        }
        
        return `
            <div class="${cardClass}">
                <div class="project-header">
                    <div class="project-code">${project.workCode}</div>
                    <div class="project-status ${statusClass}">${statusText}</div>
                </div>
                <div class="project-name">${project.name}</div>
                <div class="project-dates">📅 Aberta: ${createdStr}${closedStr ? ` | Fechada: ${closedStr}` : ''}</div>
                ${project.notes ? `<div class="project-notes" style="font-size: 12px; color: #6c757d; margin-top: 8px;">📝 ${project.notes}</div>` : ''}
                ${reopenInfoHtml}
                ${actionsHtml ? `<div class="project-actions">${actionsHtml}</div>` : ''}
            </div>
        `;
    }).join('');
}

function updateProjectsStats(projects) {
    const openCount = projects.filter(p => p.status === 'open').length;
    const closedCount = projects.filter(p => p.status === 'closed').length;
    
    let clientReopens = 0;
    let errorReopens = 0;
    
    projects.forEach(project => {
        if (project.reopenHistory && project.reopenHistory.length > 0) {
            project.reopenHistory.forEach(reopen => {
                if (reopen.reason === 'client_change') {
                    clientReopens++;
                } else if (reopen.reason === 'our_error') {
                    errorReopens++;
                }
            });
        }
    });
    
    document.getElementById('statsOpenProjects').textContent = openCount;
    document.getElementById('statsClosedProjects').textContent = closedCount;
    document.getElementById('statsClientReopens').textContent = clientReopens;
    document.getElementById('statsErrorReopens').textContent = errorReopens;
}

function closeProject(projectId) {
    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    showConfirm('Terminar Obra', `Tem a certeza que deseja terminar a obra "${project.workCode}"?\n\nIsto marcará a obra como concluída.`, function() {
        project.status = 'closed';
        project.closedDate = new Date().toISOString();
        saveProjects(projects);
        loadProjectsList();
        loadProjectSelects();
    });
}

function openReopenProjectModal(projectId) {
    const project = getProjects().find(p => p.id === projectId);
    if (!project) return;
    currentReopenProjectId = projectId;
    document.getElementById('reopenProjectCode').textContent = project.workCode;
    document.getElementById('reopenProjectName').textContent = project.name;
    document.getElementById('reopenReason').value = '';
    document.getElementById('reopenComment').value = '';
    document.getElementById('reopenProjectError').classList.add('hidden');
    document.getElementById('reopenProjectModal').classList.add('show');
}

function closeReopenProjectModal() {
    document.getElementById('reopenProjectModal').classList.remove('show');
    currentReopenProjectId = null;
}

function confirmReopenProject() {
    const errorDiv = document.getElementById('reopenProjectError');
    errorDiv.classList.add('hidden');
    const reason = document.getElementById('reopenReason').value;
    const comment = document.getElementById('reopenComment').value.trim();
    if (!reason) {
        errorDiv.textContent = '⚠️ Por favor, selecione o motivo da reabertura.';
        errorDiv.classList.remove('hidden');
        return;
    }
    const projects = getProjects();
    const projectIndex = projects.findIndex(p => p.id === currentReopenProjectId);
    if (projectIndex === -1) return;
    projects[projectIndex].status = 'open';
    delete projects[projectIndex].closedDate;
    if (!projects[projectIndex].reopenHistory) { projects[projectIndex].reopenHistory = []; }
    projects[projectIndex].reopenHistory.push({ date: new Date().toISOString(), reason: reason, comment: comment });
    saveProjects(projects);
    closeReopenProjectModal();
    loadProjectsList();
    loadProjectSelects();
}

function openComments(sessionId) {
    const history = getWorkHistory();
    const session = history.find(s => s.id === sessionId);
    if (!session) return;
    currentEditId = sessionId;
    if (session.workType === 'internal') {
        document.getElementById('commentProject').textContent = session.internalCategoryName || 'Trabalho Interno';
        document.getElementById('commentWorkCode').textContent = session.internalDescription || '';
    } else {
        document.getElementById('commentProject').textContent = session.projectName;
        document.getElementById('commentWorkCode').textContent = session.workCode;
    }
    loadSessionComments(sessionId);
    document.getElementById('commentsModal').classList.add('show');
}

function loadSessionComments(sessionId) {
    const allComments = getComments();
    const sessionComments = allComments[sessionId] || [];
    const container = document.getElementById('commentsList');
    if (sessionComments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 10px;">Sem comentários</p>';
        return;
    }
    container.innerHTML = sessionComments.map(c => `
        <div class="comment-item">
            <div class="comment-text">${c.text}</div>
            <div class="comment-meta">${new Date(c.date).toLocaleString('pt-PT')}</div>
        </div>
    `).join('');
}

function addComment() {
    const errorDiv = document.getElementById('commentError');
    const successDiv = document.getElementById('commentSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    const text = document.getElementById('newComment').value.trim();
    if (!text) {
        errorDiv.textContent = '⚠️ Por favor, escreva um comentário.';
        errorDiv.classList.remove('hidden');
        return;
    }
    const allComments = getComments();
    if (!allComments[currentEditId]) { allComments[currentEditId] = []; }
    allComments[currentEditId].push({ text: text, date: new Date().toISOString() });
    saveComments(allComments);
    const history = getWorkHistory();
    const session = history.find(s => s.id === currentEditId);
    if (session) {
        session.comment = text;
        const user = JSON.parse(localStorage.getItem('currentUser'));
        const key = `workHistory_${user.username}`;
        localStorage.setItem(key, JSON.stringify(history));
    }
    document.getElementById('newComment').value = '';
    loadSessionComments(currentEditId);
    loadWorkHistory();
    successDiv.textContent = '✅ Comentário adicionado!';
    successDiv.classList.remove('hidden');
    setTimeout(() => { successDiv.classList.add('hidden'); }, 2000);
}

function closeCommentsModal() {
    document.getElementById('commentsModal').classList.remove('show');
    currentEditId = null;
}

function loadWorkSelectForComments() {
    const projects = getProjects();
    const select = document.getElementById('selectWorkForComments');
    select.innerHTML = '<option value="">-- Selecione --</option>';
    projects.forEach(project => {
        select.innerHTML += `<option value="${project.workCode}">${project.workCode} - ${project.name}</option>`;
    });
}

function loadCommentsForWork() {
    const workCode = document.getElementById('selectWorkForComments').value;
    if (!workCode) {
        document.getElementById('commentsDisplay').classList.add('hidden');
        return;
    }
    document.getElementById('commentsDisplay').classList.remove('hidden');
    const history = getWorkHistory();
    const workSessions = history.filter(s => s.workCode === workCode);
    const allComments = getComments();
    let allWorkComments = [];
    workSessions.forEach(session => {
        const sessionComments = allComments[session.id] || [];
        allWorkComments = allWorkComments.concat(sessionComments);
    });
    const container = document.getElementById('workCommentsList');
    if (allWorkComments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 10px;">Sem comentários para esta obra</p>';
        return;
    }
    container.innerHTML = allWorkComments.map(c => `
        <div class="comment-item">
            <div class="comment-text">${c.text}</div>
            <div class="comment-meta">${new Date(c.date).toLocaleString('pt-PT')}</div>
        </div>
    `).join('');
}

function addQuickComment() {
    const workCode = document.getElementById('selectWorkForComments').value;
    const text = document.getElementById('quickComment').value.trim();
    if (!workCode || !text) {
        if (!workCode) {
            document.getElementById('selectWorkForComments').style.borderColor = '#e74c3c';
            setTimeout(() => { document.getElementById('selectWorkForComments').style.borderColor = ''; }, 2000);
        }
        if (!text) {
            document.getElementById('quickComment').style.borderColor = '#e74c3c';
            setTimeout(() => { document.getElementById('quickComment').style.borderColor = ''; }, 2000);
        }
        return;
    }
    const history = getWorkHistory();
    const lastSession = history.find(s => s.workCode === workCode);
    if (!lastSession) return;
    const allComments = getComments();
    if (!allComments[lastSession.id]) { allComments[lastSession.id] = []; }
    allComments[lastSession.id].push({ text: text, date: new Date().toISOString() });
    saveComments(allComments);
    document.getElementById('quickComment').value = '';
    loadCommentsForWork();
    loadWorkHistory();
}

function updateStats() {
    updateDadosStats();
}

function updateDadosStats() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    
    updateUserStats();
    
    if (user.isAdmin) {
        updateAdminStats();
    }
}

function updateUserStats() {
    const history = getWorkHistory();
    const now = new Date();
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    let todayTotal = 0;
    let todayProject = 0;
    let todayInternal = 0;
    
    history.forEach(session => {
        const sessionDate = new Date(session.startTime);
        if (sessionDate >= todayStart && sessionDate < todayEnd) {
            const duration = session.duration || 0;
            todayTotal += duration;
            if (session.workType === 'project') {
                todayProject += duration;
            } else if (session.workType === 'internal') {
                todayInternal += duration;
            }
        }
    });
    
    if (timerInterval && timerSeconds) {
        todayTotal += timerSeconds;
        const workType = document.querySelector('input[name="workType"]:checked')?.value;
        if (workType === 'project') {
            todayProject += timerSeconds;
        } else if (workType === 'internal') {
            todayInternal += timerSeconds;
        }
    }
    
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    let weekTotal = 0;
    let weekProject = 0;
    let weekInternal = 0;
    
    history.forEach(session => {
        const sessionDate = new Date(session.startTime);
        if (sessionDate >= weekStart && sessionDate < weekEnd) {
            const duration = session.duration || 0;
            weekTotal += duration;
            if (session.workType === 'project') {
                weekProject += duration;
            } else if (session.workType === 'internal') {
                weekInternal += duration;
            }
        }
    });
    
    if (timerInterval && timerSeconds) {
        weekTotal += timerSeconds;
        const workType = document.querySelector('input[name="workType"]:checked')?.value;
        if (workType === 'project') {
            weekProject += timerSeconds;
        } else if (workType === 'internal') {
            weekInternal += timerSeconds;
        }
    }
    
    const todayTotalEl = document.getElementById('todayTotalHours');
    const todayProjectEl = document.getElementById('todayProjectHours');
    const todayInternalEl = document.getElementById('todayInternalHours');
    
    const weekTotalEl = document.getElementById('weekTotalHours');
    const weekProjectEl = document.getElementById('weekProjectHours');
    const weekInternalEl = document.getElementById('weekInternalHours');
    
    if (todayTotalEl) todayTotalEl.textContent = formatHoursMinutes(todayTotal);
    if (todayProjectEl) todayProjectEl.textContent = formatHoursMinutes(todayProject);
    if (todayInternalEl) todayInternalEl.textContent = formatHoursMinutes(todayInternal);
    
    if (weekTotalEl) weekTotalEl.textContent = formatHoursMinutes(weekTotal);
    if (weekProjectEl) weekProjectEl.textContent = formatHoursMinutes(weekProject);
    if (weekInternalEl) weekInternalEl.textContent = formatHoursMinutes(weekInternal);
}

function updateAdminStats() {
    const adminStatsPanel = document.getElementById('adminQuickStats');
    if (!adminStatsPanel) return;
    
    adminStatsPanel.classList.remove('hidden');
    
    if (typeof getAllUsersHistory !== 'function') return;
    
    const allHistory = getAllUsersHistory();
    const now = new Date();
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    let adminTodayTotal = 0;
    let adminTodayProject = 0;
    let adminTodayInternal = 0;
    
    allHistory.forEach(session => {
        const sessionDate = new Date(session.startTime);
        if (sessionDate >= todayStart && sessionDate < todayEnd) {
            const duration = session.duration || 0;
            adminTodayTotal += duration;
            if (session.workType === 'project') {
                adminTodayProject += duration;
            } else if (session.workType === 'internal') {
                adminTodayInternal += duration;
            }
        }
    });
    
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    let adminWeekTotal = 0;
    let adminWeekProject = 0;
    let adminWeekInternal = 0;
    
    allHistory.forEach(session => {
        const sessionDate = new Date(session.startTime);
        if (sessionDate >= weekStart && sessionDate < weekEnd) {
            const duration = session.duration || 0;
            adminWeekTotal += duration;
            if (session.workType === 'project') {
                adminWeekProject += duration;
            } else if (session.workType === 'internal') {
                adminWeekInternal += duration;
            }
        }
    });
    
    const adminTodayTotalEl = document.getElementById('adminTodayTotal');
    const adminTodayProjectEl = document.getElementById('adminTodayProject');
    const adminTodayInternalEl = document.getElementById('adminTodayInternal');
    
    const adminWeekTotalEl = document.getElementById('adminWeekTotal');
    const adminWeekProjectEl = document.getElementById('adminWeekProject');
    const adminWeekInternalEl = document.getElementById('adminWeekInternal');
    
    if (adminTodayTotalEl) adminTodayTotalEl.textContent = formatHoursMinutes(adminTodayTotal);
    if (adminTodayProjectEl) adminTodayProjectEl.textContent = formatHoursMinutes(adminTodayProject);
    if (adminTodayInternalEl) adminTodayInternalEl.textContent = formatHoursMinutes(adminTodayInternal);
    
    if (adminWeekTotalEl) adminWeekTotalEl.textContent = formatHoursMinutes(adminWeekTotal);
    if (adminWeekProjectEl) adminWeekProjectEl.textContent = formatHoursMinutes(adminWeekProject);
    if (adminWeekInternalEl) adminWeekInternalEl.textContent = formatHoursMinutes(adminWeekInternal);
    
    if (typeof getAllUsersProjects === 'function') {
        const users = getUsers();
        const allProjects = getAllUsersProjects();
        const totalHours = allHistory.reduce((sum, s) => sum + s.duration, 0);
        
        const dashCompanyUsersEl = document.getElementById('dashCompanyTotalUsers');
        const dashCompanyProjectsEl = document.getElementById('dashCompanyTotalProjects');
        const dashCompanySessionsEl = document.getElementById('dashCompanyTotalSessions');
        const dashCompanyHoursEl = document.getElementById('dashCompanyTotalHours');
        
        if (dashCompanyUsersEl) dashCompanyUsersEl.textContent = users.length;
        if (dashCompanyProjectsEl) dashCompanyProjectsEl.textContent = allProjects.filter(p => p.status === 'open').length;
        if (dashCompanySessionsEl) dashCompanySessionsEl.textContent = allHistory.length;
        if (dashCompanyHoursEl) dashCompanyHoursEl.textContent = formatHours(totalHours);
    }
}

function updateReports() {
    const typeFilter = document.getElementById('reportTypeFilter').value;
    const departmentFilter = document.getElementById('reportFilter').value;
    const internalCategoryFilter = document.getElementById('internalCategoryFilter').value;
    const history = getWorkHistory();
    const departmentFilterSection = document.getElementById('departmentFilterSection');
    const internalCategoryFilterSection = document.getElementById('internalCategoryFilterSection');
    if (typeFilter === 'project') {
        departmentFilterSection.classList.remove('hidden');
        internalCategoryFilterSection.classList.add('hidden');
    } else if (typeFilter === 'internal') {
        departmentFilterSection.classList.add('hidden');
        internalCategoryFilterSection.classList.remove('hidden');
    } else {
        departmentFilterSection.classList.remove('hidden');
        internalCategoryFilterSection.classList.add('hidden');
    }
    let filteredHistory = history;
    if (typeFilter === 'project') {
        filteredHistory = filteredHistory.filter(s => s.workType === 'project');
        if (departmentFilter !== 'all') {
            filteredHistory = filteredHistory.filter(s => s.projectType === departmentFilter);
        }
    } else if (typeFilter === 'internal') {
        filteredHistory = filteredHistory.filter(s => s.workType === 'internal');
        if (internalCategoryFilter !== 'all') {
            filteredHistory = filteredHistory.filter(s => s.internalCategory === internalCategoryFilter);
        }
    } else {
        if (departmentFilter !== 'all') {
            filteredHistory = filteredHistory.filter(s => s.workType === 'internal' || s.projectType === departmentFilter);
        }
    }
    const projectSeconds = filteredHistory.filter(s => s.workType === 'project').reduce((sum, s) => sum + s.duration, 0);
    const internalSeconds = filteredHistory.filter(s => s.workType === 'internal').reduce((sum, s) => sum + s.duration, 0);
    document.getElementById('totalProjectHours').textContent = formatHours(projectSeconds);
    document.getElementById('totalInternalHours').textContent = formatHours(internalSeconds);
    const container = document.getElementById('fullHistory');
    if (filteredHistory.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem dados para mostrar</p>';
        return;
    }
    container.innerHTML = filteredHistory.map(session => {
        const date = new Date(session.startTime);
        const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const commentHtml = session.comment ? `<div class="hist-comment">💬 ${session.comment}</div>` : '';
        let badgesHtml = '';
        if (session.workType === 'internal') { badgesHtml += '<span class="hist-badge badge-internal">🏠 Interno</span>'; }
        if (session.manualEntry) { badgesHtml += '<span class="hist-badge badge-manual">📝 Inserido Manualmente</span>'; }
        if (session.manualEdit) { badgesHtml += '<span class="hist-badge badge-edited">✏️ Editado Manualmente</span>'; }
        let mainInfo = '';
        let subInfo = '';
        if (session.workType === 'internal') {
            mainInfo = session.internalCategoryName || 'Trabalho Interno';
            subInfo = `<div class="hist-obra">📝 ${session.internalDescription || ''}</div>`;
            if (session.relatedProjects && session.relatedProjects.length > 0) {
                const projectsList = session.relatedProjects.map(p => p.workCode).join(', ');
                subInfo += `<div class="hist-obra">🏗️ Obras: ${projectsList}</div>`;
            }
        } else {
            mainInfo = session.projectName;
            const workNameHtml = session.workName ? `<div class="hist-obra">📋 ${session.workCode} - ${session.workName}</div>` : `<div class="hist-obra">📋 ${session.workCode}</div>`;
            const subcategoryHtml = session.subcategory ? `<div class="hist-obra">🏷️ ${session.subcategory}</div>` : '';
            subInfo = `${subcategoryHtml}${workNameHtml}`;
        }
        const itemClass = session.workType === 'internal' ? 'history-item internal' : 'history-item';
        return `
            <div class="${itemClass}">
                <div class="hist-project">${mainInfo} ${badgesHtml}</div>
                ${subInfo}
                <div class="hist-time">⏱️ ${formatDuration(session.duration)}</div>
                <div class="hist-date">${dateStr}</div>
                ${commentHtml}
                <div class="hist-actions">
                    <button class="btn btn-primary btn-small" onclick="editSession(${session.id})">✏️ Editar</button>
                    <button class="btn btn-warning btn-small" onclick="openComments(${session.id})">💬 Comentário</button>
                    <button class="btn btn-danger btn-small" onclick="deleteSession(${session.id})">🗑️ Apagar</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateExportStats() {
    const history = getWorkHistory();
    const users = getUsers();
    const projects = getProjects();
    document.getElementById('exportSessionCount').textContent = history.length;
    document.getElementById('exportProjectCount').textContent = projects.length;
    document.getElementById('exportUserCount').textContent = users.length;
}

function exportCSV() {
    const history = getWorkHistory();
    if (history.length === 0) {
        showAlert('Aviso', 'Não há dados para exportar.');
        return;
    }
    let csv = 'Data Início,Hora Início,Data Fim,Hora Fim,Utilizador,Tipo Trabalho,Departamento/Categoria,Subcategoria,Código Obra/Descrição,Nome Obra,Obras Relacionadas,Duração (segundos),Duração (horas),Comentário\n';
    history.forEach(session => {
        const startDate = new Date(session.startTime);
        const endDate = new Date(session.endTime);
        const startDateStr = `${startDate.getDate()}/${startDate.getMonth() + 1}/${startDate.getFullYear()}`;
        const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        const endDateStr = `${endDate.getDate()}/${endDate.getMonth() + 1}/${endDate.getFullYear()}`;
        const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        const hours = (session.duration / 3600).toFixed(2);
        const comment = session.comment || '';
        const workTypeLabel = session.workType === 'internal' ? 'Interno' : 'Projeto';
        let departmentCategory = '';
        let subcategory = '';
        let workCodeDescription = '';
        let workName = '';
        let relatedProjects = '';
        if (session.workType === 'internal') {
            departmentCategory = session.internalCategoryName || '';
            workCodeDescription = session.internalDescription || '';
            if (session.relatedProjects && session.relatedProjects.length > 0) {
                relatedProjects = session.relatedProjects.map(p => p.workCode).join('; ');
            }
        } else {
            departmentCategory = session.projectName || '';
            subcategory = session.subcategory || '';
            workCodeDescription = session.workCode || '';
            workName = session.workName || '';
        }
        csv += `${startDateStr},${startTimeStr},${endDateStr},${endTimeStr},"${session.userName}","${workTypeLabel}","${departmentCategory}","${subcategory}","${workCodeDescription}","${workName}","${relatedProjects}",${session.duration},${hours},"${comment}"\n`;
    });
    downloadFile(csv, 'controlo_obra.csv', 'text/csv');
}

function exportJSON() {
    const history = getWorkHistory();
    if (history.length === 0) {
        showAlert('Aviso', 'Não há dados para exportar.');
        return;
    }
    const json = JSON.stringify(history, null, 2);
    downloadFile(json, 'controlo_obra.json', 'application/json');
}

function backupData() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const history = getWorkHistory();
    const users = getUsers();
    const comments = getComments();
    const projects = getProjects();
    const backup = { version: '3.1', exportDate: new Date().toISOString(), currentUser: user, workHistory: history, comments: comments, projects: projects, users: users.map(u => ({ firstName: u.firstName, lastName: u.lastName, username: u.username })) };
    const json = JSON.stringify(backup, null, 2);
    downloadFile(json, `backup_controlo_obra_${Date.now()}.json`, 'application/json');
}

function restoreData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.version || !backup.workHistory) {
                showAlert('Erro', 'Ficheiro de backup inválido.');
                return;
            }
            showConfirm('Confirmar Restauro', 'Isto irá substituir os seus dados atuais. Deseja continuar?', function() {
                const user = JSON.parse(localStorage.getItem('currentUser'));
                const key = `workHistory_${user.username}`;
                localStorage.setItem(key, JSON.stringify(backup.workHistory));
                if (backup.comments) {
                    const commentsKey = `comments_${user.username}`;
                    localStorage.setItem(commentsKey, JSON.stringify(backup.comments));
                }
                showAlert('Sucesso', 'Dados restaurados com sucesso!');
                loadWorkHistory();
                updateStats();
                updateReports();
                loadWorkSelectForComments();
                loadProjectSelects();
                loadProjectsList();
            });
        } catch (error) {
            showAlert('Erro', 'Erro ao ler o ficheiro de backup.');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

function loadProfileData() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const users = getUsers();
    const currentUserData = users.find(u => u.username === user.username);
    
    if (!currentUserData) return;
    
    document.getElementById('profileFirstName').value = currentUserData.firstName || '';
    document.getElementById('profileLastName').value = currentUserData.lastName || '';
    document.getElementById('profileUsername').value = currentUserData.username || '';
    document.getElementById('profileDepartment').value = currentUserData.defaultDepartment || '';
    
    const accountType = currentUserData.isAdmin ? '👑 Administrador' : '👤 Utilizador Normal';
    document.getElementById('profileAccountType').textContent = accountType;
    
    document.getElementById('profileOldPassword').value = '';
    document.getElementById('profileNewPassword').value = '';
    document.getElementById('profileConfirmPassword').value = '';
    
    loadProfilePhoto(); 
    document.getElementById('profileError').classList.add('hidden');
    document.getElementById('profileSuccess').classList.add('hidden');
}

function updatePersonalInfo() {
    const errorDiv = document.getElementById('profileError');
    const successDiv = document.getElementById('profileSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const firstName = document.getElementById('profileFirstName').value.trim();
    const lastName = document.getElementById('profileLastName').value.trim();
    const department = document.getElementById('profileDepartment').value;
    
    if (!firstName || !lastName) {
        errorDiv.textContent = '⚠️ Por favor, preencha o nome completo.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const users = getUsers();
    const userIndex = users.findIndex(u => u.username === currentUser.username);
    
    if (userIndex === -1) return;
    
    users[userIndex].firstName = firstName;
    users[userIndex].lastName = lastName;
    users[userIndex].defaultDepartment = department;
    
    saveUsers(users);
    
    currentUser.firstName = firstName;
    currentUser.lastName = lastName;
    currentUser.defaultDepartment = department;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    document.getElementById('userName').textContent = `${firstName} ${lastName}`;
    
    successDiv.textContent = '✅ Informações pessoais atualizadas com sucesso!';
    successDiv.classList.remove('hidden');
    
    setTimeout(() => { successDiv.classList.add('hidden'); }, 3000);
}

async function updateUsername() {
    const errorDiv = document.getElementById('profileError');
    const successDiv = document.getElementById('profileSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const newUsername = document.getElementById('profileUsername').value.trim();
    
    if (!newUsername) {
        errorDiv.textContent = '⚠️ Por favor, insira um nome de utilizador.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (newUsername.length < 3) {
        errorDiv.textContent = '⚠️ O nome de utilizador deve ter pelo menos 3 caracteres.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (newUsername === currentUser.username) {
        errorDiv.textContent = '⚠️ Este já é o seu nome de utilizador atual.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const users = getUsers();
    
    if (users.find(u => u.username === newUsername)) {
        errorDiv.textContent = '⚠️ Este nome de utilizador já está em uso.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    showConfirm('Alterar Username', 
        `Tem certeza que deseja alterar o username de "${currentUser.username}" para "${newUsername}"?`,
        async function() {
            const userIndex = users.findIndex(u => u.username === currentUser.username);
            if (userIndex === -1) return;
            
            const oldUsername = users[userIndex].username;
            users[userIndex].username = newUsername;
            saveUsers(users);
            
            const oldHistoryKey = `workHistory_${oldUsername}`;
            const oldProjectsKey = `projects_${oldUsername}`;
            const oldCommentsKey = `comments_${oldUsername}`;
            
            const history = localStorage.getItem(oldHistoryKey);
            const projects = localStorage.getItem(oldProjectsKey);
            const comments = localStorage.getItem(oldCommentsKey);
            
            if (history) {
                localStorage.setItem(`workHistory_${newUsername}`, history);
                localStorage.removeItem(oldHistoryKey);
            }
            if (projects) {
                localStorage.setItem(`projects_${newUsername}`, projects);
                localStorage.removeItem(oldProjectsKey);
            }
            if (comments) {
                localStorage.setItem(`comments_${newUsername}`, comments);
                localStorage.removeItem(oldCommentsKey);
            }
            
            currentUser.username = newUsername;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            if (localStorage.getItem('activeTimer')) {
                const timerState = JSON.parse(localStorage.getItem('activeTimer'));
                timerState.username = newUsername;
                localStorage.setItem('activeTimer', JSON.stringify(timerState));
            }
            
            successDiv.textContent = `✅ Username alterado com sucesso para "${newUsername}"! Continua com a sessão ativa.`;
            successDiv.classList.remove('hidden');
            
            setTimeout(() => { successDiv.classList.add('hidden'); }, 4000);
        }
    );
}

async function updatePassword() {
    const errorDiv = document.getElementById('profileError');
    const successDiv = document.getElementById('profileSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const oldPassword = document.getElementById('profileOldPassword').value;
    const newPassword = document.getElementById('profileNewPassword').value;
    const confirmPassword = document.getElementById('profileConfirmPassword').value;
    
    if (!oldPassword || !newPassword || !confirmPassword) {
        errorDiv.textContent = '⚠️ Por favor, preencha todos os campos de password.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (newPassword.length < 6) {
        errorDiv.textContent = '⚠️ A nova password deve ter pelo menos 6 caracteres.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = '⚠️ As passwords não coincidem.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const users = getUsers();
    const userIndex = users.findIndex(u => u.username === currentUser.username);
    
    if (userIndex === -1) return;
    
    const oldPasswordHash = await sha256(oldPassword);
    
    if (users[userIndex].password !== oldPasswordHash) {
        errorDiv.textContent = '⚠️ Password atual incorreta.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    showConfirm('Alterar Password', 
        'Tem certeza que deseja alterar a password?\n\nPor questões de segurança, será desconectado e terá de fazer login novamente com a nova password.',
        async function() {
            const newPasswordHash = await sha256(newPassword);
            users[userIndex].password = newPasswordHash;
            saveUsers(users);
            
            localStorage.removeItem('currentUser');
            localStorage.removeItem('activeTimer');
            
            showAlert('Password Alterada', 'Password alterada com sucesso!\n\nVai ser redirecionado para o login. Use a sua nova password.');
            
            setTimeout(() => {
                showLogin();
            }, 2500);
        }
    );
}

function showMainTab(event, tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    if (tabName === 'timer') {
        document.getElementById('timerTab').classList.add('active');
        updateHoursCounter();
    } else if (tabName === 'dados') {
        document.getElementById('dadosTab').classList.add('active');
        showSubTab(null, 'dados', 'overview', true);
        loadWorkHistory();
        updateStats();
        updateDadosAdminStats();
        updateHoursCounter();
    } else if (tabName === 'obras') {
        document.getElementById('obrasTab').classList.add('active');
        showSubTab(null, 'obras', 'lista', true);
    } else if (tabName === 'calendario') {
        document.getElementById('calendarioTab').classList.add('active');
        showSubTab(null, 'calendario', 'anual', true);
    } else if (tabName === 'equipa') {
        document.getElementById('equipaTab').classList.add('active');
        showSubTab(null, 'equipa', 'horas', true);
    } else if (tabName === 'profile') {
        document.getElementById('profileTab').classList.add('active');
        loadProfileData();
    }
}

function showSubTab(event, parentTab, subTabName, programmatic = false) {
    if (!programmatic && event) {
        const parentElement = document.getElementById(`${parentTab}Tab`);
        parentElement.querySelectorAll('.sub-tab').forEach(tab => tab.classList.remove('active'));
        parentElement.querySelectorAll('.sub-content').forEach(content => content.classList.remove('active'));
        
        event.target.classList.add('active');
    } else if (programmatic) {
        const parentElement = document.getElementById(`${parentTab}Tab`);
        const subTabs = parentElement.querySelectorAll('.sub-tab');
        subTabs.forEach(tab => tab.classList.remove('active'));
        if (subTabs[0]) subTabs[0].classList.add('active');
        
        parentElement.querySelectorAll('.sub-content').forEach(content => content.classList.remove('active'));
    }
    
    const subContentId = `${parentTab}-${subTabName}`;
    const subContent = document.getElementById(subContentId);
    if (subContent) {
        subContent.classList.add('active');
    }
    
    if (parentTab === 'obras') {
        if (subTabName === 'lista') {
            loadProjectsList();
        } else if (subTabName === 'horas') {
            initHorasPorObra();
        } else if (subTabName === 'reaberturas') {
            if (typeof updateReopensView === 'function') {
                updateReopensView();
            }
        } else if (subTabName === 'comments') {
            loadWorkSelectForComments();
        }
    } else if (parentTab === 'calendario') {
        if (subTabName === 'anual') {
            if (typeof initializeAnnualCalendar === 'function') {
                initializeAnnualCalendar();
            }
        } else if (subTabName === 'semanas') {
            populateWeeksYearFilter();
        }
    } else if (parentTab === 'equipa') {
        if (subTabName === 'horas') {
            if (typeof populateTeamUserFilter === 'function') {
                populateTeamUserFilter();
            }
            if (typeof updateTeamHoursView === 'function') {
                updateTeamHoursView();
            }
        } else if (subTabName === 'obras') {
            if (typeof updateProjectHoursView === 'function') {
                updateProjectHoursView();
            }
        } else if (subTabName === 'reaberturas') {
            if (typeof updateAdminReopensView === 'function') {
                updateAdminReopensView();
            }
        } else if (subTabName === 'calendarios') {
            if (typeof populateTeamCalendarUserFilter === 'function') {
                populateTeamCalendarUserFilter();
                getTeamVacationsSummary();
            }
        } else if (subTabName === 'utilizadores') {
            if (typeof loadAdminUsersList === 'function') {
                loadAdminUsersList();
            }
        }
    } else if (parentTab === 'dados') {
        if (subTabName === 'reports') {
            updateReports();
        } else if (subTabName === 'export') {
            updateExportStats();
        }
    }
}

function updateDadosAdminStats() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    const adminStatsPanel = document.getElementById('adminQuickStats');
    
    if (!adminStatsPanel) return;
    
    if (user && user.isAdmin === true) {
        adminStatsPanel.classList.remove('hidden');
        
        if (typeof getAllUsersHistory === 'function' && typeof getAllUsersProjects === 'function') {
            const users = getUsers();
            const allHistory = getAllUsersHistory();
            const allProjects = getAllUsersProjects();
            const totalHours = allHistory.reduce((sum, s) => sum + s.duration, 0);
            
            document.getElementById('dashCompanyTotalUsers').textContent = users.length;
            document.getElementById('dashCompanyTotalProjects').textContent = allProjects.filter(p => p.status === 'open').length;
            document.getElementById('dashCompanyTotalSessions').textContent = allHistory.length;
            document.getElementById('dashCompanyTotalHours').textContent = formatHours(totalHours);
        }
    } else {
        adminStatsPanel.classList.add('hidden');
    }
}

function setupAdminUIEnhanced() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    
    if (user && user.isAdmin) {
        const header = document.getElementById('mainHeader');
        if (header) {
            header.classList.add('admin');
        }
        
        const adminBadge = document.getElementById('adminBadge');
        if (adminBadge) {
            adminBadge.classList.remove('hidden');
        }
        
        const adminSubTabs = document.querySelectorAll('.admin-sub-tab');
        adminSubTabs.forEach(tab => tab.classList.remove('hidden'));
        
        const adminOnlyTabs = document.querySelectorAll('.admin-only-tab');
        adminOnlyTabs.forEach(tab => tab.classList.remove('hidden'));
        
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.classList.remove('hidden');
        }
        
        if (typeof populateGlobalUserFilter === 'function') {
            populateGlobalUserFilter();
        }
    } else {
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.classList.add('hidden');
        }
        
        const adminSubTabs = document.querySelectorAll('.admin-sub-tab');
        adminSubTabs.forEach(tab => tab.classList.add('hidden'));
        
        const adminOnlyTabs = document.querySelectorAll('.admin-only-tab');
        adminOnlyTabs.forEach(tab => tab.classList.add('hidden'));
    }
}

window.addEventListener('load', () => {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) { showApp(); } else { showLogin(); }
});

window.addEventListener('beforeunload', (e) => {
    if (timerInterval) {
        e.preventDefault();
        e.returnValue = '';
    }
});

function loadProfilePhoto() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    
    const photoData = localStorage.getItem(`profilePhoto_${user.username}`);
    const preview = document.getElementById('profilePhotoPreview');
    const placeholder = document.querySelector('.profile-photo-placeholder');
    const removeBtn = document.getElementById('removePhotoBtn');
    const initials = document.getElementById('profileInitials');
    
    if (photoData) {
        preview.src = photoData;
        preview.classList.add('active');
        placeholder.classList.add('hidden');
        removeBtn.style.display = 'inline-block';
    } else {
        preview.classList.remove('active');
        placeholder.classList.remove('hidden');
        removeBtn.style.display = 'none';
        
        const firstName = user.firstName || '';
        const lastName = user.lastName || '';
        const initial1 = firstName.charAt(0) || '';
        const initial2 = lastName.charAt(0) || '';
        initials.textContent = (initial1 + initial2).toUpperCase() || '?';
    }
}

function handleProfilePhotoChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showAlert('Erro', 'Por favor selecione um ficheiro de imagem válido.');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showAlert('Erro', 'A imagem é muito grande. Por favor selecione uma imagem menor que 2MB.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        localStorage.setItem(`profilePhoto_${user.username}`, e.target.result);
        loadProfilePhoto();
        showAlert('Sucesso', 'Foto de perfil atualizada com sucesso!');
    };
    reader.readAsDataURL(file);
}

function removeProfilePhoto() {
    showConfirm('Remover Foto', 'Tem certeza que deseja remover a foto de perfil?', function() {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        localStorage.removeItem(`profilePhoto_${user.username}`);
        document.getElementById('profilePhotoInput').value = '';
        loadProfilePhoto();
        showAlert('Sucesso', 'Foto de perfil removida com sucesso!');
    });
}

function updateHoursCounter() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    
    const todayElement = document.getElementById('hoursTodayValue');
    const weekElement = document.getElementById('hoursWeekValue');
    if (!todayElement || !weekElement) return;
    
    const workHistory = getWorkHistory();
    const now = new Date();
    

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    let todaySeconds = 0;
    workHistory.forEach(entry => {
        const entryDate = new Date(entry.startTime);
        if (entryDate >= todayStart && entryDate < todayEnd) {
            todaySeconds += entry.duration || 0;
        }
    });
    
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    let weekSeconds = 0;
    workHistory.forEach(entry => {
        const entryDate = new Date(entry.startTime);
        if (entryDate >= weekStart && entryDate < weekEnd) {
            weekSeconds += entry.duration || 0;
        }
    });
    
    if (timerInterval && timerSeconds) {
        todaySeconds += timerSeconds;
        weekSeconds += timerSeconds;
    }
    
    todayElement.textContent = formatHoursMinutes(todaySeconds);
    weekElement.textContent = formatHoursMinutes(weekSeconds);
}

function formatHoursMinutes(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

setInterval(function() {
    const dadosTab = document.getElementById('dadosTab');
    if (dadosTab && dadosTab.classList.contains('active')) {
        updateDadosStats();
    }
}, 30000);


setTimeout(function() {
    updateHoursCounter();
}, 1000);


function updateWeeksView() {
    const year = parseInt(document.getElementById('weeksYearFilter').value);
    const selectedMonth = document.getElementById('weeksMonthFilter').value;
    const selectedWeek = document.getElementById('weeksWeekFilter').value;
    const history = getWorkHistory();
    const container = document.getElementById('weeksContainer');
    
    if (!container) return;
    
    const allWeeks = calculateWeeksInYear(year, history);
    
    let filteredWeeks = allWeeks;
    if (selectedMonth !== 'all') {
        const monthNum = parseInt(selectedMonth);
        filteredWeeks = allWeeks.filter(week => {
            const startParts = week.startDate.split('/');
            const endParts = week.endDate.split('/');
            const startMonth = parseInt(startParts[1]);
            const endMonth = parseInt(endParts[1]);
            return startMonth === monthNum || endMonth === monthNum;
        });
    }
    
    if (selectedWeek !== 'all') {
        const weekNum = parseInt(selectedWeek);
        filteredWeeks = filteredWeeks.filter(week => week.weekNumber === weekNum);
    }
    
    if (filteredWeeks.length === 0 || filteredWeeks.every(w => w.totalSeconds === 0)) {
        let message = `Sem horas registadas em ${year}`;
        if (selectedMonth !== 'all') {
            const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                               'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            message = `Sem horas registadas em ${monthNames[parseInt(selectedMonth) - 1]} ${year}`;
        }
        if (selectedWeek !== 'all') {
            message = `Sem horas registadas na semana ${selectedWeek} de ${year}`;
        }
        
        container.innerHTML = `
            <div class="empty-weeks">
                <div class="empty-weeks-icon">📊</div>
                <p>${message}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredWeeks.reverse().map(week => {
        if (week.totalSeconds === 0) return '';
        
        return `
            <div class="week-card">
                <div class="week-header">
                    <div>
                        <div class="week-number">📅 Semana ${week.weekNumber}</div>
                        <div class="week-dates">${week.startDate} - ${week.endDate}</div>
                    </div>
                </div>
                <div class="week-stats">
                    <div class="week-stat-item">
                        <div class="week-stat-value">${formatHoursMinutes(week.totalSeconds)}</div>
                        <div class="week-stat-label">⏱️ Total</div>
                    </div>
                    <div class="week-stat-item project">
                        <div class="week-stat-value">${formatHoursMinutes(week.projectSeconds)}</div>
                        <div class="week-stat-label">🏢 Projeto</div>
                    </div>
                    <div class="week-stat-item internal">
                        <div class="week-stat-value">${formatHoursMinutes(week.internalSeconds)}</div>
                        <div class="week-stat-label">🏠 Interno</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function calculateWeeksInYear(year, history) {
    const weeks = [];
    
    let currentDate = new Date(year, 0, 1);
    const dayOfWeek = currentDate.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
    currentDate.setDate(currentDate.getDate() + daysUntilMonday);
    
    let weekNumber = 1;
    
    if (currentDate.getMonth() !== 0) {
        currentDate = new Date(year, 0, 1);
        const lastDayOfPrevYear = new Date(year - 1, 11, 31);
        const tempDate = new Date(lastDayOfPrevYear);
        tempDate.setDate(tempDate.getDate() - tempDate.getDay() + 1);
        weekNumber = getWeekNumber(lastDayOfPrevYear) + 1;
    }
    
    while (currentDate.getFullYear() === year) {
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        if (weekEnd.getFullYear() > year) {
            weekEnd.setFullYear(year);
            weekEnd.setMonth(11);
            weekEnd.setDate(31);
        }
        
        let totalSeconds = 0;
        let projectSeconds = 0;
        let internalSeconds = 0;
        
        history.forEach(session => {
            const sessionDate = new Date(session.startTime);
            if (sessionDate >= weekStart && sessionDate <= weekEnd) {
                totalSeconds += session.duration || 0;
                if (session.workType === 'project') {
                    projectSeconds += session.duration || 0;
                } else if (session.workType === 'internal') {
                    internalSeconds += session.duration || 0;
                }
            }
        });
        
        weeks.push({
            weekNumber: weekNumber,
            startDate: formatDateShort(weekStart),
            endDate: formatDateShort(weekEnd),
            totalSeconds,
            projectSeconds,
            internalSeconds
        });
        
        currentDate.setDate(currentDate.getDate() + 7);
        weekNumber++;
    }
    
    return weeks;
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatDateShort(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
}

function populateWeeksYearFilter() {
    const select = document.getElementById('weeksYearFilter');
    if (!select) return;
    
    const history = getWorkHistory();
    const years = new Set();
    
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    
    history.forEach(session => {
        const year = new Date(session.startTime).getFullYear();
        years.add(year);
    });
    
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    
    select.innerHTML = sortedYears.map(year => 
        `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`
    ).join('');
    
    updateWeeksMonthFilter();
}

function updateWeeksMonthFilter() {
    const year = parseInt(document.getElementById('weeksYearFilter').value);
    const history = getWorkHistory();
    const monthSelect = document.getElementById('weeksMonthFilter');
    
    if (!monthSelect) return;
    
    const weeks = calculateWeeksInYear(year, history);
    
    const monthsWithHours = new Set();
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    weeks.forEach(week => {
        if (week.totalSeconds > 0) {
            const startParts = week.startDate.split('/');
            const endParts = week.endDate.split('/');
            monthsWithHours.add(parseInt(startParts[1]));
            monthsWithHours.add(parseInt(endParts[1]));
        }
    });
    
    if (year === currentYear) {
        monthsWithHours.add(currentMonth);
    }
    
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    let options = '<option value="all">Todos os meses</option>';
    
    const sortedMonths = Array.from(monthsWithHours).sort((a, b) => {
        if (year === currentYear) {
            return b - a;
        } else {
            return b - a;
        }
    });
    
    sortedMonths.forEach(month => {
        const selected = (year === currentYear && month === currentMonth) ? 'selected' : '';
        options += `<option value="${month}" ${selected}>${monthNames[month - 1]}</option>`;
    });
    
    monthSelect.innerHTML = options;
    
    updateWeeksWeekFilter();
}

function updateWeeksWeekFilter() {
    const year = parseInt(document.getElementById('weeksYearFilter').value);
    const selectedMonth = document.getElementById('weeksMonthFilter').value;
    const history = getWorkHistory();
    const weekSelect = document.getElementById('weeksWeekFilter');
    
    if (!weekSelect) return;
    
    const allWeeks = calculateWeeksInYear(year, history);
    
    let availableWeeks = allWeeks;
    if (selectedMonth !== 'all') {
        const monthNum = parseInt(selectedMonth);
        availableWeeks = allWeeks.filter(week => {
            const startParts = week.startDate.split('/');
            const endParts = week.endDate.split('/');
            const startMonth = parseInt(startParts[1]);
            const endMonth = parseInt(endParts[1]);
            return (startMonth === monthNum || endMonth === monthNum) && week.totalSeconds > 0;
        });
    } else {
        availableWeeks = allWeeks.filter(week => week.totalSeconds > 0);
    }
    
    let options = '<option value="all">Todas as semanas</option>';
    
    availableWeeks.reverse().forEach(week => {
        options += `<option value="${week.weekNumber}">Semana ${week.weekNumber} (${week.startDate} - ${week.endDate})</option>`;
    });
    
    weekSelect.innerHTML = options;
    
    updateWeeksView();
}

function updateReopensView() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    
    const allProjects = JSON.parse(localStorage.getItem('projects_global')) || [];
    const myHistory = getWorkHistory();
    
    console.log('updateReopensView - Total projects:', allProjects.length);
    console.log('updateReopensView - My history sessions:', myHistory.length);
    
    const clientReopens = [];
    const errorReopens = [];
    
    allProjects.forEach(project => {
        if (!project.reopenHistory || project.reopenHistory.length === 0) return;
        
        console.log('Project with reopenHistory:', project.workCode, project.reopenHistory);
        
        const clientReopenDates = project.reopenHistory
            .filter(r => r.reason === 'client_change')
            .map(r => new Date(r.date));
        
        const errorReopenDates = project.reopenHistory
            .filter(r => r.reason === 'our_error')
            .map(r => new Date(r.date));
        
        const firstClientReopen = clientReopenDates.length > 0 ? new Date(Math.min(...clientReopenDates)) : null;
        const firstErrorReopen = errorReopenDates.length > 0 ? new Date(Math.min(...errorReopenDates)) : null;
        
        let clientHours = 0;
        let errorHours = 0;
        
        const projectSessions = myHistory.filter(s => s.workType === 'project' && s.workCode === project.workCode);
        
        console.log('Sessions for', project.workCode, ':', projectSessions.length);
        
        projectSessions.forEach(session => {
            const sessionDate = new Date(session.startTime);
            
            if (firstClientReopen && sessionDate >= firstClientReopen) {
                clientHours += session.duration;
                console.log('Adding to clientHours:', session.duration, 'from session on', sessionDate);
            }
            
            if (firstErrorReopen && sessionDate >= firstErrorReopen) {
                errorHours += session.duration;
                console.log('Adding to errorHours:', session.duration, 'from session on', sessionDate);
            }
        });
        
        if (clientReopenDates.length > 0) {
            clientReopens.push({
                workCode: project.workCode,
                name: project.name,
                status: project.status,
                reopenHistory: project.reopenHistory.filter(r => r.reason === 'client_change'),
                totalHours: clientHours,
                reopenCount: clientReopenDates.length
            });
        }
        
        if (errorReopenDates.length > 0) {
            errorReopens.push({
                workCode: project.workCode,
                name: project.name,
                status: project.status,
                reopenHistory: project.reopenHistory.filter(r => r.reason === 'our_error'),
                totalHours: errorHours,
                reopenCount: errorReopenDates.length
            });
        }
    });
    
    const clientTotalHours = clientReopens.reduce((sum, p) => sum + p.totalHours, 0);
    const errorTotalHours = errorReopens.reduce((sum, p) => sum + p.totalHours, 0);
    
    console.log('Final - Client reopens:', clientReopens.length, 'Total hours:', clientTotalHours);
    console.log('Final - Error reopens:', errorReopens.length, 'Total hours:', errorTotalHours);
    
    document.getElementById('reopenClientCount').textContent = clientReopens.length;
    document.getElementById('reopenClientHours').textContent = formatHoursMinutes(clientTotalHours);
    document.getElementById('reopenErrorCount').textContent = errorReopens.length;
    document.getElementById('reopenErrorHours').textContent = formatHoursMinutes(errorTotalHours);
    
    renderReopenList('reopenClientList', clientReopens, 'client_change');
    renderReopenList('reopenErrorList', errorReopens, 'our_error');
}

function renderReopenList(containerId, projects, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const typeLabel = type === 'client_change' ? 'alteração do cliente' : 'erro interno';
    const typeIcon = type === 'client_change' ? '👤' : '⚠️';
    
    if (projects.length === 0) {
        container.innerHTML = '<div class="empty-reopen-data"><div class="empty-icon">' + typeIcon + '</div><p>Sem obras reabertas por ' + typeLabel + '</p></div>';
        return;
    }
    
    projects.sort((a, b) => b.totalHours - a.totalHours);
    
    let html = '';
    projects.forEach(project => {
        const statusBadge = project.status === 'closed' ? '<span class="status-badge closed">Fechada</span>' : '<span class="status-badge open">Aberta</span>';
        const safeId = project.workCode.replace(/[^a-zA-Z0-9]/g, '_') + '_' + type;
        
        html += '<div class="reopen-item" onclick="toggleReopenDetails(\'' + safeId + '\')">';
        html += '<div class="reopen-item-header">';
        html += '<div class="reopen-item-info"><div class="reopen-item-code">' + project.workCode + '</div><div class="reopen-item-name">' + (project.name || 'Sem nome') + '</div></div>';
        html += '<div class="reopen-item-stats"><span class="reopen-badge">' + project.reopenCount + 'x reaberta</span>' + statusBadge + '<span class="reopen-hours">' + formatHoursMinutes(project.totalHours) + '</span></div>';
        html += '</div>';
        html += '<div class="reopen-item-details hidden" id="details-' + safeId + '">';
        html += '<div class="reopen-detail-section"><h5>📅 Histórico de Reaberturas</h5><div class="reopen-history-list">';
        
        project.reopenHistory.forEach(r => {
            const date = new Date(r.date);
            const dateStr = date.getDate().toString().padStart(2, '0') + '/' + (date.getMonth() + 1).toString().padStart(2, '0') + '/' + date.getFullYear();
            html += '<div class="reopen-history-item"><span class="reopen-date">' + dateStr + '</span><span class="reopen-note">' + (r.comment || 'Sem observação') + '</span></div>';
        });
        
        html += '</div></div></div></div>';
    });
    
    container.innerHTML = html;
}

function toggleReopenDetails(id) {
    const details = document.getElementById('details-' + id);
    if (details) {
        details.classList.toggle('hidden');
    }
}


function initHorasPorObra() {
    populateHorasPorObraSelect();
    updateHorasPorObraSubcategories();
    updateHorasPorObra();
}

function populateHorasPorObraSelect() {
    const statusFilter = document.getElementById('horasObraStatusFilter').value;
    const select = document.getElementById('horasObraSelect');
    const allProjects = getProjects();
    
    let filteredProjects = allProjects;
    if (statusFilter === 'open') {
        filteredProjects = allProjects.filter(p => p.status === 'open');
    } else if (statusFilter === 'closed') {
        filteredProjects = allProjects.filter(p => p.status === 'closed');
    }
    
    filteredProjects.sort((a, b) => a.workCode.localeCompare(b.workCode));
    
    select.innerHTML = '<option value="all">Todas as Obras</option>';
    filteredProjects.forEach(project => {
        const statusIcon = project.status === 'open' ? '🟢' : '🔴';
        select.innerHTML += `<option value="${project.workCode}">${statusIcon} ${project.workCode} - ${project.name || 'Sem nome'}</option>`;
    });
}

function updateHorasPorObraSubcategories() {
    const department = document.getElementById('horasObraDepartmentFilter').value;
    const subcategorySelect = document.getElementById('horasObraSubcategoryFilter');
    const subcategoryGroup = document.getElementById('horasObraSubcategoryGroup');
    
    subcategorySelect.innerHTML = '<option value="all">Todas</option>';
    
    if (department !== 'all' && subcategories[department] && subcategories[department].length > 0) {
        subcategoryGroup.style.display = 'flex';
        subcategories[department].forEach(sub => {
            subcategorySelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    } else {
        subcategoryGroup.style.display = department === 'all' ? 'flex' : 'none';
        
        if (department === 'all') {
            const allSubs = new Set();
            Object.values(subcategories).forEach(subs => {
                subs.forEach(sub => allSubs.add(sub));
            });
            Array.from(allSubs).sort().forEach(sub => {
                subcategorySelect.innerHTML += `<option value="${sub}">${sub}</option>`;
            });
        }
    }
}

function updateHorasPorObra() {
    const statusFilter = document.getElementById('horasObraStatusFilter').value;
    const selectedProject = document.getElementById('horasObraSelect').value;
    const departmentFilter = document.getElementById('horasObraDepartmentFilter').value;
    const subcategoryFilter = document.getElementById('horasObraSubcategoryFilter').value;
    
    populateHorasPorObraSelect();
    
    const allProjects = getProjects();
    const myHistory = getWorkHistory();
        let filteredProjects = allProjects;
    if (statusFilter === 'open') {
        filteredProjects = allProjects.filter(p => p.status === 'open');
    } else if (statusFilter === 'closed') {
        filteredProjects = allProjects.filter(p => p.status === 'closed');
    }
    
    if (selectedProject !== 'all') {
        filteredProjects = filteredProjects.filter(p => p.workCode === selectedProject);
    }
    
    let filteredSessions = myHistory.filter(s => s.workType === 'project');
    
    if (departmentFilter !== 'all') {
        filteredSessions = filteredSessions.filter(s => s.projectType === departmentFilter);
    }
    
    if (subcategoryFilter !== 'all') {
        filteredSessions = filteredSessions.filter(s => s.subcategory === subcategoryFilter);
    }
    
    const projectsData = {};
    
    filteredProjects.forEach(project => {
        const projectSessions = filteredSessions.filter(s => s.workCode === project.workCode);
        
        if (projectSessions.length > 0 || selectedProject === project.workCode) {
            const totalSeconds = projectSessions.reduce((sum, s) => sum + s.duration, 0);
            
            const byDepartment = {};
            projectSessions.forEach(s => {
                const dept = s.projectType || 'outros';
                if (!byDepartment[dept]) byDepartment[dept] = 0;
                byDepartment[dept] += s.duration;
            });
            
            const bySubcategory = {};
            projectSessions.forEach(s => {
                const sub = s.subcategory || 'Sem subcategoria';
                if (!bySubcategory[sub]) bySubcategory[sub] = 0;
                bySubcategory[sub] += s.duration;
            });
            
            projectsData[project.workCode] = {
                project: project,
                sessions: projectSessions,
                totalSeconds: totalSeconds,
                byDepartment: byDepartment,
                bySubcategory: bySubcategory
            };
        }
    });
    
    const totalHours = Object.values(projectsData).reduce((sum, p) => sum + p.totalSeconds, 0);
    const totalSessions = Object.values(projectsData).reduce((sum, p) => sum + p.sessions.length, 0);
    const totalProjects = Object.keys(projectsData).length;
    
    document.getElementById('horasObraTotalHours').textContent = formatHoursMinutes(totalHours);
    document.getElementById('horasObraTotalSessions').textContent = totalSessions;
    document.getElementById('horasObraTotalProjects').textContent = totalProjects;
    
    renderHorasPorObraList(projectsData);
}

function renderHorasPorObraList(projectsData) {
    const container = document.getElementById('horasObraList');
    
    if (Object.keys(projectsData).length === 0) {
        container.innerHTML = `
            <div class="horas-obra-empty">
                <div class="horas-obra-empty-icon">📋</div>
                <p>Sem registos para os filtros selecionados</p>
                <p style="font-size: 12px; margin-top: 10px;">Experimente alterar os filtros ou selecionar uma obra diferente</p>
            </div>
        `;
        return;
    }
    
    const sortedProjects = Object.values(projectsData).sort((a, b) => b.totalSeconds - a.totalSeconds);
    
    let html = '';
    sortedProjects.forEach(data => {
        const project = data.project;
        const statusClass = project.status === 'open' ? 'open' : 'closed';
        const statusText = project.status === 'open' ? 'Aberta' : 'Concluída';
        const safeId = project.workCode.replace(/[^a-zA-Z0-9]/g, '_');
        
        html += `
            <div class="horas-obra-card">
                <div class="horas-obra-card-header" onclick="toggleHorasObraDetails('${safeId}')">
                    <div class="horas-obra-card-info">
                        <div class="horas-obra-card-code">${project.workCode}</div>
                        <div class="horas-obra-card-name">${project.name || 'Sem nome'}</div>
                    </div>
                    <div class="horas-obra-card-stats">
                        <span class="horas-obra-status-badge ${statusClass}">${statusText}</span>
                        <span class="horas-obra-card-sessions">${data.sessions.length} sessões</span>
                        <span class="horas-obra-card-hours">${formatHoursMinutes(data.totalSeconds)}</span>
                    </div>
                </div>
                <div class="horas-obra-card-details hidden" id="horas-obra-${safeId}">
                    ${renderHorasObraBreakdown(data)}
                    ${renderHorasObraSessions(data.sessions)}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderHorasObraBreakdown(data) {
    let html = '<div class="horas-obra-breakdown">';
    
    if (Object.keys(data.byDepartment).length > 0) {
        html += '<h5>🏢 Por Departamento</h5><div class="horas-obra-breakdown-grid">';
        Object.entries(data.byDepartment).sort((a, b) => b[1] - a[1]).forEach(([dept, seconds]) => {
            html += `
                <div class="horas-obra-breakdown-item department">
                    <div class="horas-obra-breakdown-label">${getDepartmentName(dept)}</div>
                    <div class="horas-obra-breakdown-value">${formatHoursMinutes(seconds)}</div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (Object.keys(data.bySubcategory).length > 0) {
        html += '<h5 style="margin-top: 15px;">📂 Por Subcategoria</h5><div class="horas-obra-breakdown-grid">';
        Object.entries(data.bySubcategory).sort((a, b) => b[1] - a[1]).forEach(([sub, seconds]) => {
            html += `
                <div class="horas-obra-breakdown-item subcategory">
                    <div class="horas-obra-breakdown-label">${sub}</div>
                    <div class="horas-obra-breakdown-value">${formatHoursMinutes(seconds)}</div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

function renderHorasObraSessions(sessions) {
    if (sessions.length === 0) return '';
    
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    
    const displaySessions = sortedSessions.slice(0, 10);
    
    let html = '<div class="horas-obra-sessions-list">';
    html += `<h5>📝 Últimas Sessões ${sessions.length > 10 ? `(${displaySessions.length} de ${sessions.length})` : ''}</h5>`;
    
    displaySessions.forEach(session => {
        const date = new Date(session.startTime);
        const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        const dept = getDepartmentName(session.projectType) || 'N/A';
        const sub = session.subcategory || '';
        
        html += `
            <div class="horas-obra-session-item">
                <div class="horas-obra-session-info">
                    <div class="horas-obra-session-date">${dateStr} às ${timeStr}</div>
                    <div class="horas-obra-session-meta">${dept}${sub ? ' • ' + sub : ''}</div>
                </div>
                <div class="horas-obra-session-duration">${formatHoursMinutes(session.duration)}</div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function toggleHorasObraDetails(id) {
    const details = document.getElementById('horas-obra-' + id);
    if (details) {
        details.classList.toggle('hidden');
    }
}

function exportHorasPorObraCSV() {
    const statusFilter = document.getElementById('horasObraStatusFilter').value;
    const selectedProject = document.getElementById('horasObraSelect').value;
    const departmentFilter = document.getElementById('horasObraDepartmentFilter').value;
    const subcategoryFilter = document.getElementById('horasObraSubcategoryFilter').value;
    
    const allProjects = getProjects();
    const myHistory = getWorkHistory();
    
    let filteredProjects = allProjects;
    if (statusFilter === 'open') {
        filteredProjects = allProjects.filter(p => p.status === 'open');
    } else if (statusFilter === 'closed') {
        filteredProjects = allProjects.filter(p => p.status === 'closed');
    }
    
    if (selectedProject !== 'all') {
        filteredProjects = filteredProjects.filter(p => p.workCode === selectedProject);
    }
    
    let filteredSessions = myHistory.filter(s => s.workType === 'project');
    
    if (departmentFilter !== 'all') {
        filteredSessions = filteredSessions.filter(s => s.projectType === departmentFilter);
    }
    
    if (subcategoryFilter !== 'all') {
        filteredSessions = filteredSessions.filter(s => s.subcategory === subcategoryFilter);
    }
    
    const projectCodes = new Set(filteredProjects.map(p => p.workCode));
    filteredSessions = filteredSessions.filter(s => projectCodes.has(s.workCode));
    
    let csv = 'Código Obra,Nome Obra,Estado,Data,Hora Início,Hora Fim,Departamento,Subcategoria,Duração (h),Comentário\n';
    
    filteredSessions.sort((a, b) => new Date(a.startTime) - new Date(b.startTime)).forEach(session => {
        const project = allProjects.find(p => p.workCode === session.workCode);
        const startDate = new Date(session.startTime);
        const endDate = new Date(session.endTime);
        
        const dateStr = `${startDate.getDate().toString().padStart(2, '0')}/${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getFullYear()}`;
        const startTimeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
        const endTimeStr = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
        const durationHours = (session.duration / 3600).toFixed(2);
        
        const status = project ? (project.status === 'open' ? 'Aberta' : 'Concluída') : 'N/A';
        const projectName = project ? (project.name || '') : '';
        const dept = getDepartmentName(session.projectType) || '';
        const sub = session.subcategory || '';
        const comment = (session.comment || '').replace(/"/g, '""');
        
        csv += `"${session.workCode}","${projectName}","${status}","${dateStr}","${startTimeStr}","${endTimeStr}","${dept}","${sub}","${durationHours}","${comment}"\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `horas_por_obra_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

const originalShowSubTab = window.showSubTab;
window.showSubTab = function(event, parentTab, subTabName, programmatic = false) {
    if (originalShowSubTab) {
        originalShowSubTab(event, parentTab, subTabName, programmatic);
    }
};

// ==================== NOVAS FUNCIONALIDADES ====================

// Duplicar sessão
function duplicateSession(sessionId) {
    const history = getWorkHistory();
    const session = history.find(s => s.id === sessionId);
    if (!session) return;
    
    // Abrir modal de entrada manual com dados pré-preenchidos
    openManualEntry();
    
    setTimeout(() => {
        if (session.workType === 'internal') {
            document.getElementById('manualWorkTypeInternal').checked = true;
            updateManualFields();
            document.getElementById('manualInternalCategory').value = session.internalCategory || 'reuniao';
            document.getElementById('manualInternalDescription').value = session.internalDescription || '';
            updateManualMeetingProjects();
        } else {
            document.getElementById('manualWorkTypeProject').checked = true;
            updateManualFields();
            const project = getProjects().find(p => p.workCode === session.workCode);
            if (project) {
                document.getElementById('manualProjectSelect').value = project.id;
            }
            if (session.projectType) {
                document.getElementById('manualProjectType').value = session.projectType;
                updateManualSubcategories();
            }
            if (session.subcategory) {
                document.getElementById('manualSubcategory').value = session.subcategory;
            }
        }
        
        // Definir data/hora para agora
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - session.duration * 1000);
        document.getElementById('manualStartTime').value = formatDateTimeLocal(oneHourAgo);
        document.getElementById('manualEndTime').value = formatDateTimeLocal(now);
    }, 100);
    
    showAlert('Duplicar Sessão', 'Dados da sessão copiados. Ajuste as datas e guarde.');
}

// Meta diária
let dailyGoalHours = 8;

function updateDailyGoal() {
    const select = document.getElementById('dailyGoalSelect');
    dailyGoalHours = parseInt(select.value) || 0;
    localStorage.setItem('dailyGoalHours', dailyGoalHours);
    updateDailyGoalProgress();
}

function loadDailyGoalSetting() {
    const saved = localStorage.getItem('dailyGoalHours');
    if (saved !== null) {
        dailyGoalHours = parseInt(saved);
        const select = document.getElementById('dailyGoalSelect');
        if (select) select.value = dailyGoalHours;
    }
}

function updateDailyGoalProgress() {
    const history = getWorkHistory();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayHistory = history.filter(h => new Date(h.startTime) >= today);
    const todaySeconds = todayHistory.reduce((sum, h) => sum + h.duration, 0);
    
    // Adicionar tempo do timer atual se estiver a correr
    let totalSeconds = todaySeconds;
    if (timerInterval && startTime) {
        totalSeconds += timerSeconds;
    }
    
    const goalSeconds = dailyGoalHours * 3600;
    const percent = goalSeconds > 0 ? Math.min(100, (totalSeconds / goalSeconds) * 100) : 0;
    
    const fill = document.getElementById('dailyGoalFill');
    const current = document.getElementById('dailyGoalCurrent');
    const target = document.getElementById('dailyGoalTarget');
    const percentEl = document.getElementById('dailyGoalPercent');
    
    if (fill) {
        fill.style.width = percent + '%';
        // Mudar cor baseado no progresso
        if (percent >= 100) {
            fill.style.backgroundColor = '#27ae60';
        } else if (percent >= 75) {
            fill.style.backgroundColor = '#2ecc71';
        } else if (percent >= 50) {
            fill.style.backgroundColor = '#f39c12';
        } else {
            fill.style.backgroundColor = '#3498db';
        }
    }
    if (current) current.textContent = formatHoursMinutes(totalSeconds);
    if (target) target.textContent = dailyGoalHours > 0 ? dailyGoalHours + 'h' : '--';
    if (percentEl) percentEl.textContent = dailyGoalHours > 0 ? `(${Math.round(percent)}%)` : '';
}

// Estatísticas mensais
function updateMonthStats() {
    const history = getWorkHistory();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthHistory = history.filter(h => new Date(h.startTime) >= startOfMonth);
    let monthTotal = monthHistory.reduce((sum, h) => sum + h.duration, 0);
    let monthProject = monthHistory.filter(h => h.workType === 'project').reduce((sum, h) => sum + h.duration, 0);
    let monthInternal = monthHistory.filter(h => h.workType === 'internal').reduce((sum, h) => sum + h.duration, 0);
    
    // INCLUIR TIMER ATIVO se estiver a correr
    if (timerInterval && timerSeconds) {
        monthTotal += timerSeconds;
        const workType = document.querySelector('input[name="workType"]:checked')?.value;
        if (workType === 'project') {
            monthProject += timerSeconds;
        } else if (workType === 'internal') {
            monthInternal += timerSeconds;
        }
    }
    
    const totalEl = document.getElementById('monthTotalHours');
    const projectEl = document.getElementById('monthProjectHours');
    const internalEl = document.getElementById('monthInternalHours');
    
    if (totalEl) totalEl.textContent = formatHoursMinutes(monthTotal);
    if (projectEl) projectEl.textContent = formatHoursMinutes(monthProject);
    if (internalEl) internalEl.textContent = formatHoursMinutes(monthInternal);
    
    // Atualizar gráfico semanal
    updateWeeklyChart();
    
    // Atualizar gráficos circulares
    updatePieCharts();
}

// Gráfico de barras das últimas 4 semanas
function updateWeeklyChart() {
    const container = document.getElementById('weeklyChart');
    if (!container) return;
    
    const history = getWorkHistory();
    const now = new Date();
    const weeks = [];
    
    // Calcular últimas 4 semanas
    for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() - (i * 7));
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        const weekHistory = history.filter(h => {
            const d = new Date(h.startTime);
            return d >= weekStart && d <= weekEnd;
        });
        
        const weekTotal = weekHistory.reduce((sum, h) => sum + h.duration, 0);
        const weekProject = weekHistory.filter(h => h.workType === 'project').reduce((sum, h) => sum + h.duration, 0);
        const weekInternal = weekHistory.filter(h => h.workType === 'internal').reduce((sum, h) => sum + h.duration, 0);
        
        weeks.push({
            label: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
            total: weekTotal,
            project: weekProject,
            internal: weekInternal
        });
    }
    
    // Encontrar máximo para escala
    const maxHours = Math.max(...weeks.map(w => w.total / 3600), 1);
    
    container.innerHTML = weeks.map(week => {
        const projectPercent = (week.project / 3600 / maxHours) * 100;
        const internalPercent = (week.internal / 3600 / maxHours) * 100;
        const hours = (week.total / 3600).toFixed(1);
        
        return `
            <div class="weekly-bar-container">
                <div class="weekly-bar">
                    <div class="weekly-bar-project" style="height: ${projectPercent}%"></div>
                    <div class="weekly-bar-internal" style="height: ${internalPercent}%"></div>
                </div>
                <div class="weekly-bar-label">${week.label}</div>
                <div class="weekly-bar-hours">${hours}h</div>
            </div>
        `;
    }).join('');
}

// ==================== GRÁFICOS CIRCULARES (DONUT CHARTS) ====================

function drawDonutChart(canvasId, projectHours, internalHours) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 80;
    const innerRadius = 50;
    
    const total = projectHours + internalHours;
    
    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (total === 0) {
        // Mostrar círculo cinzento se não houver dados
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#e9ecef';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        // Texto "Sem dados"
        ctx.fillStyle = '#95a5a6';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Sem dados', centerX, centerY);
        return;
    }
    
    const projectAngle = (projectHours / total) * 2 * Math.PI;
    const internalAngle = (internalHours / total) * 2 * Math.PI;
    
    // Desenhar fatia de Projeto (azul/roxo)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + projectAngle);
    ctx.arc(centerX, centerY, innerRadius, -Math.PI / 2 + projectAngle, -Math.PI / 2, true);
    ctx.closePath();
    const gradientProject = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradientProject.addColorStop(0, '#667eea');
    gradientProject.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradientProject;
    ctx.fill();
    
    // Desenhar fatia de Interno (rosa/vermelho)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, -Math.PI / 2 + projectAngle, -Math.PI / 2 + projectAngle + internalAngle);
    ctx.arc(centerX, centerY, innerRadius, -Math.PI / 2 + projectAngle + internalAngle, -Math.PI / 2 + projectAngle, true);
    ctx.closePath();
    const gradientInternal = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradientInternal.addColorStop(0, '#ff7675');
    gradientInternal.addColorStop(1, '#fd79a8');
    ctx.fillStyle = gradientInternal;
    ctx.fill();
    
    // Centro branco
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    
    // Percentagens
    const projectPercent = Math.round((projectHours / total) * 100);
    const internalPercent = Math.round((internalHours / total) * 100);
    
    // Mostrar AMBAS as percentagens
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Percentagem de Projeto (azul)
    ctx.fillStyle = '#667eea';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(projectPercent + '%', centerX, centerY - 12);
    ctx.font = '10px Arial';
    ctx.fillStyle = '#7f8c8d';
    ctx.fillText('Projeto', centerX, centerY - 0);
    
    // Percentagem de Interno (rosa)
    ctx.fillStyle = '#ff7675';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(internalPercent + '%', centerX, centerY + 12);
    ctx.font = '10px Arial';
    ctx.fillStyle = '#7f8c8d';
    ctx.fillText('Interno', centerX, centerY + 24);
}

function updatePieCharts() {
    const history = getWorkHistory();
    const now = new Date();
    
    // Calcular Hoje
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const todayHistory = history.filter(session => {
        const sessionDate = new Date(session.startTime);
        return sessionDate >= todayStart && sessionDate < todayEnd;
    });
    
    let todayProject = todayHistory.filter(h => h.workType === 'project').reduce((sum, h) => sum + h.duration, 0);
    let todayInternal = todayHistory.filter(h => h.workType === 'internal').reduce((sum, h) => sum + h.duration, 0);
    
    // Adicionar timer ativo se estiver a correr
    if (timerInterval && timerSeconds) {
        const workType = document.querySelector('input[name="workType"]:checked')?.value;
        if (workType === 'project') {
            todayProject += timerSeconds;
        } else if (workType === 'internal') {
            todayInternal += timerSeconds;
        }
    }
    
    // Calcular Esta Semana
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const weekHistory = history.filter(session => {
        const sessionDate = new Date(session.startTime);
        return sessionDate >= weekStart && sessionDate < weekEnd;
    });
    
    let weekProject = weekHistory.filter(h => h.workType === 'project').reduce((sum, h) => sum + h.duration, 0);
    let weekInternal = weekHistory.filter(h => h.workType === 'internal').reduce((sum, h) => sum + h.duration, 0);
    
    // Adicionar timer ativo se estiver a correr
    if (timerInterval && timerSeconds) {
        const workType = document.querySelector('input[name="workType"]:checked')?.value;
        if (workType === 'project') {
            weekProject += timerSeconds;
        } else if (workType === 'internal') {
            weekInternal += timerSeconds;
        }
    }
    
    // Calcular Este Mês
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthHistory = history.filter(h => new Date(h.startTime) >= startOfMonth);
    
    let monthProject = monthHistory.filter(h => h.workType === 'project').reduce((sum, h) => sum + h.duration, 0);
    let monthInternal = monthHistory.filter(h => h.workType === 'internal').reduce((sum, h) => sum + h.duration, 0);
    
    // Adicionar timer ativo
    if (timerInterval && timerSeconds) {
        const workType = document.querySelector('input[name="workType"]:checked')?.value;
        if (workType === 'project') {
            monthProject += timerSeconds;
        } else if (workType === 'internal') {
            monthInternal += timerSeconds;
        }
    }
    
    // Desenhar gráficos
    drawDonutChart('todayPieChart', todayProject, todayInternal);
    drawDonutChart('weekPieChart', weekProject, weekInternal);
    drawDonutChart('monthPieChart', monthProject, monthInternal);
}

// Favoritos de obras
function getFavoriteProjects() {
    const saved = localStorage.getItem('favoriteProjects');
    return saved ? JSON.parse(saved) : [];
}

function saveFavoriteProjects(favorites) {
    localStorage.setItem('favoriteProjects', JSON.stringify(favorites));
}

function toggleFavoriteProject(projectId) {
    let favorites = getFavoriteProjects();
    const index = favorites.indexOf(projectId);
    
    if (index > -1) {
        favorites.splice(index, 1);
    } else {
        favorites.push(projectId);
    }
    
    saveFavoriteProjects(favorites);
    loadProjectSelects(); // Recarregar selects com favoritos no topo
}

// Sobrescrever loadProjectSelects para mostrar favoritos primeiro
const originalLoadProjectSelects = loadProjectSelects;
function loadProjectSelectsWithFavorites() {
    const openProjects = getOpenProjects();
    const favorites = getFavoriteProjects();
    
    // Separar favoritos e não favoritos
    const favoriteProjects = openProjects.filter(p => favorites.includes(p.id));
    const otherProjects = openProjects.filter(p => !favorites.includes(p.id));
    
    const selects = ['projectSelect', 'manualProjectSelect', 'editProjectSelect'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        let html = '<option value="">-- Selecione uma obra --</option>';
        
        if (favoriteProjects.length > 0) {
            html += '<optgroup label="⭐ Favoritos">';
            favoriteProjects.forEach(p => {
                html += `<option value="${p.id}">⭐ ${p.workCode} - ${p.name || 'Sem nome'}</option>`;
            });
            html += '</optgroup>';
        }
        
        if (otherProjects.length > 0) {
            html += '<optgroup label="📋 Outras Obras">';
            otherProjects.forEach(p => {
                html += `<option value="${p.id}">${p.workCode} - ${p.name || 'Sem nome'}</option>`;
            });
            html += '</optgroup>';
        }
        
        select.innerHTML = html;
    });
}

// Substituir função original
loadProjectSelects = loadProjectSelectsWithFavorites;

// Notificação de fim de dia
let endOfDayNotified = false;

function checkEndOfDayNotification() {
    const now = new Date();
    const hour = now.getHours();
    
    // Verificar às 18h
    if (hour === 18 && !endOfDayNotified) {
        const history = getWorkHistory();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayHistory = history.filter(h => new Date(h.startTime) >= today);
        const todaySeconds = todayHistory.reduce((sum, h) => sum + h.duration, 0);
        const todayHours = todaySeconds / 3600;
        
        if (todayHours < dailyGoalHours && dailyGoalHours > 0) {
            const remaining = dailyGoalHours - todayHours;
            showAlert('⏰ Fim de Dia', 
                `Ainda faltam ${remaining.toFixed(1)} horas para atingir a meta diária de ${dailyGoalHours}h.`);
            endOfDayNotified = true;
        }
    }
    
    // Reset à meia-noite
    if (hour === 0) {
        endOfDayNotified = false;
    }
}

// Inicialização das novas funcionalidades
const originalShowApp = showApp;
showApp = function() {
    originalShowApp();
    loadDailyGoalSetting();
    updateDailyGoalProgress();
    updateMonthStats();
    showLastSessionPanel();
    
    // Verificar notificação a cada minuto
    setInterval(checkEndOfDayNotification, 60000);
};

// Atualizar meta diária quando o timer muda
const originalUpdateTimerDisplay = updateTimerDisplay;
let monthStatsUpdateCounter = 0;
let pieChartUpdateCounter = 0;
if (typeof updateTimerDisplay === 'function') {
    updateTimerDisplay = function() {
        originalUpdateTimerDisplay();
        updateDailyGoalProgress();
        
        // Atualizar stats mensais a cada 10 segundos (não em cada segundo)
        monthStatsUpdateCounter++;
        if (monthStatsUpdateCounter >= 10) {
            updateMonthStats();
            monthStatsUpdateCounter = 0;
        }
        
        // Atualizar gráficos circulares a cada 5 segundos
        pieChartUpdateCounter++;
        if (pieChartUpdateCounter >= 5) {
            updatePieCharts();
            pieChartUpdateCounter = 0;
        }
    };
}

// Atualizar stats quando para o timer
const originalStopWork = stopWork;
stopWork = function() {
    originalStopWork();
    setTimeout(() => {
        updateDailyGoalProgress();
        updateMonthStats();
        showLastSessionPanel();
    }, 500);
};

// ==================== FUNCIONALIDADES ÚTEIS ====================

// Mostrar painel da última sessão
function showLastSessionPanel() {
    const history = getWorkHistory();
    const panel = document.getElementById('lastSessionPanel');
    if (!panel || history.length === 0) {
        if (panel) panel.classList.add('hidden');
        return;
    }
    
    const lastSession = history[0];
    let desc = '';
    
    if (lastSession.workType === 'project') {
        desc = `${lastSession.workCode} - ${getDepartmentName(lastSession.projectType)}`;
        if (lastSession.subcategory) desc += ` (${lastSession.subcategory})`;
    } else {
        desc = lastSession.internalCategoryName || 'Trabalho Interno';
    }
    
    document.getElementById('lastSessionDesc').textContent = desc;
    panel.classList.remove('hidden');
}

// Repetir última sessão
function repeatLastSession() {
    const history = getWorkHistory();
    if (history.length === 0) {
        showAlert('Aviso', 'Não há sessões anteriores para repetir.');
        return;
    }
    
    const lastSession = history[0];
    
    // Preencher campos do timer
    if (lastSession.workType === 'project') {
        document.getElementById('workTypeProject').checked = true;
        updateWorkTypeFields();
        
        const project = getProjects().find(p => p.workCode === lastSession.workCode);
        if (project) {
            document.getElementById('projectSelect').value = project.id;
        }
        
        if (lastSession.projectType) {
            document.getElementById('projectType').value = lastSession.projectType;
            updateSubcategories();
        }
        
        if (lastSession.subcategory) {
            setTimeout(() => {
                document.getElementById('subcategory').value = lastSession.subcategory;
            }, 100);
        }
    } else {
        document.getElementById('workTypeInternal').checked = true;
        updateWorkTypeFields();
        
        if (lastSession.internalCategory) {
            document.getElementById('internalCategory').value = lastSession.internalCategory;
        }
    }
    
    showToastNotification('Configuração da última sessão carregada!', 'success');
}

// Toast de notificação simples
function showToastNotification(message, type = 'info') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 20px)';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ==================== SINCRONIZAR FOTO DE PERFIL COM CABEÇALHO ====================

function updateHeaderPhoto() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;
    
    const photoData = localStorage.getItem(`profilePhoto_${user.username}`);
    const headerPhoto = document.getElementById('headerUserPhoto');
    const headerPhotoImg = document.getElementById('headerPhotoImg');
    const headerPhotoPlaceholder = document.getElementById('headerPhotoPlaceholder');
    const headerPhotoInitials = document.getElementById('headerPhotoInitials');
    
    if (!headerPhoto) return;
    
    // Mostrar container (remover hidden e adicionar active)
    headerPhoto.classList.remove('hidden');
    headerPhoto.classList.add('active');
    
    if (photoData && headerPhotoImg) {
        // Tem foto
        headerPhotoImg.src = photoData;
        headerPhotoImg.classList.add('active');
        if (headerPhotoPlaceholder) headerPhotoPlaceholder.classList.add('hidden');
    } else {
        // Sem foto - mostrar iniciais
        if (headerPhotoImg) headerPhotoImg.classList.remove('active');
        if (headerPhotoPlaceholder) headerPhotoPlaceholder.classList.remove('hidden');
        
        const firstName = user.firstName || '';
        const lastName = user.lastName || '';
        const initial1 = firstName.charAt(0) || '';
        const initial2 = lastName.charAt(0) || '';
        
        if (headerPhotoInitials) {
            headerPhotoInitials.textContent = (initial1 + initial2).toUpperCase() || '?';
        }
    }
}

function hideHeaderPhoto() {
    const headerPhoto = document.getElementById('headerUserPhoto');
    if (headerPhoto) {
        headerPhoto.classList.remove('active');
        headerPhoto.classList.add('hidden');
    }
}

// Interceptar loadProfilePhoto original para atualizar também o cabeçalho
const _originalLoadProfilePhoto = loadProfilePhoto;
loadProfilePhoto = function() {
    _originalLoadProfilePhoto();
    updateHeaderPhoto();
};

// Interceptar handleProfilePhotoChange para atualizar cabeçalho
const _originalHandleProfilePhotoChange = handleProfilePhotoChange;
handleProfilePhotoChange = function(event) {
    _originalHandleProfilePhotoChange(event);
    setTimeout(() => updateHeaderPhoto(), 100);
};

// Interceptar removeProfilePhoto para atualizar cabeçalho
const _originalRemoveProfilePhoto = removeProfilePhoto;
removeProfilePhoto = function() {
    _originalRemoveProfilePhoto();
    setTimeout(() => updateHeaderPhoto(), 100);
};

// Atualizar no showApp
// Alias para compatibilidade
window.setupAdminUI = setupAdminUIEnhanced;

// Override showApp para atualizar foto no cabeçalho
const _originalShowApp3 = showApp;
showApp = function() {
    _originalShowApp3();
    setTimeout(() => updateHeaderPhoto(), 100);
};

// Esconder no showLogin
const _originalShowLogin3 = showLogin;
showLogin = function() {
    _originalShowLogin3();
    hideHeaderPhoto();
};

// Inicializar ao carregar
document.addEventListener('DOMContentLoaded', function() {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        setTimeout(() => updateHeaderPhoto(), 200);
    }
});

// ==================== DETEÇÃO DE VISIBILIDADE DA JANELA ====================
// Resolver bug: não detetar inatividade quando janela está minimizada

// Detetar quando janela fica escondida (minimizada, outra aba, etc.)
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Janela escondida - utilizador pode estar a trabalhar noutro lado
        windowIsVisible = false;
        console.log('🔵 Janela minimizada - deteção de inatividade PAUSADA');
    } else {
        // Janela voltou a estar visível
        windowIsVisible = true;
        // Resetar timer de atividade para não acusar imediatamente
        lastActivityTime = Date.now();
        // Recalcular timer para mostrar tempo correto
        recalculateTimerFromStartTime();
        console.log('🟢 Janela ativa - deteção de inatividade RETOMADA + Timer atualizado');
    }
});

// Fallback para browsers mais antigos (focus/blur)
window.addEventListener('blur', function() {
    windowIsVisible = false;
    console.log('🔵 Janela perdeu foco - deteção de inatividade PAUSADA');
});

window.addEventListener('focus', function() {
    windowIsVisible = true;
    lastActivityTime = Date.now();
    // Recalcular timer também no focus
    recalculateTimerFromStartTime();
    console.log('🟢 Janela ganhou foco - deteção de inatividade RETOMADA + Timer atualizado');
});