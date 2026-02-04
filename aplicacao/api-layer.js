// ==================== API LAYER ====================
// Este ficheiro substitui as funções de localStorage por chamadas à API
// Mantém compatibilidade com o código original

const API_URL = window.location.origin + '/api';
let authToken = localStorage.getItem('authToken');

// Cache para dados (evitar chamadas repetidas)
let _cachedProjects = null;
let _cachedUsers = null;
let _cachedHistory = null;
let _cacheTime = 0;
const CACHE_TTL = 10000; // 10 segundos

// ==================== FUNÇÃO BASE DE API ====================

async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        headers: { 'Content-Type': 'application/json' }
    };

    if (authToken) {
        defaultOptions.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...options.headers }
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, finalOptions);
        
        if (response.status === 401 || response.status === 403) {
            // Só fazer logout se for uma chamada de autenticação ou se não tivermos token
            if (endpoint.includes('/auth/') || !authToken) {
                throw new Error('Credenciais inválidas');
            }
            // Para outras chamadas, apenas lançar erro sem logout
            throw new Error('Erro de autenticação');
        }

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro na requisição');
        }

        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

function invalidateCache() {
    _cachedProjects = null;
    _cachedUsers = null;
    _cachedHistory = null;
    _cacheTime = 0;
}

// ==================== OVERRIDE: PROJECTS ====================

const _originalGetProjects = window.getProjects;
window.getProjects = function() {
    // Retornar cache síncrono se disponível
    if (_cachedProjects && (Date.now() - _cacheTime < CACHE_TTL)) {
        return _cachedProjects;
    }
    // Retornar array vazio e carregar em background
    loadProjectsAsync();
    return _cachedProjects || [];
};

async function loadProjectsAsync() {
    try {
        const projects = await apiRequest('/projects');
        _cachedProjects = projects.map(p => ({
            id: p.id,
            workCode: p.workCode,
            name: p.name,
            status: p.status,
            notes: p.notes,
            createdAt: p.createdAt,
            closedAt: p.closedAt,
            reopenHistory: p.reopenHistory || []
        }));
        _cacheTime = Date.now();
    } catch (error) {
        console.error('Erro ao carregar projetos:', error);
    }
}

window.saveProjects = function(projects) {
    // Não faz nada - projetos são salvos via API individual
    console.log('saveProjects called - use API instead');
};

window.getOpenProjects = function() {
    return getProjects().filter(p => p.status === 'open');
};

window.getProjectByCode = function(code) {
    return getProjects().find(p => p.workCode === code);
};

window.getProjectById = function(id) {
    return getProjects().find(p => p.id == id);
};

// ==================== OVERRIDE: USERS ====================

window.getUsers = function() {
    if (_cachedUsers && (Date.now() - _cacheTime < CACHE_TTL)) {
        return _cachedUsers;
    }
    loadUsersAsync();
    return _cachedUsers || [];
};

async function loadUsersAsync() {
    try {
        const users = await apiRequest('/users');
        _cachedUsers = users.map(u => ({
            id: u.id,
            username: u.username,
            firstName: u.firstName,
            lastName: u.lastName,
            defaultDepartment: u.defaultDepartment,
            isAdmin: u.isAdmin,
            profilePhoto: u.profilePhoto
        }));
    } catch (error) {
        console.error('Erro ao carregar utilizadores:', error);
    }
}

window.saveUsers = function(users) {
    console.log('saveUsers called - use API instead');
};

// ==================== OVERRIDE: WORK HISTORY ====================

window.getWorkHistory = function() {
    if (_cachedHistory && (Date.now() - _cacheTime < CACHE_TTL)) {
        return _cachedHistory;
    }
    loadHistoryAsync();
    return _cachedHistory || [];
};

async function loadHistoryAsync() {
    try {
        const sessions = await apiRequest('/sessions');
        _cachedHistory = sessions.map(s => ({
            id: s.id,
            odei: s.odei,
            userName: s.userName,
            workType: s.workType,
            workCode: s.workCode,
            workName: s.workName,
            projectType: s.projectType,
            subcategory: s.subcategory,
            internalCategory: s.internalCategory,
            internalCategoryName: s.internalCategoryName,
            internalDescription: s.internalDescription,
            startTime: s.startTime,
            endTime: s.endTime,
            duration: s.duration,
            comment: s.comment,
            manualEntry: s.manualEntry,
            relatedProjects: s.relatedProjects || []
        }));
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
    }
}

window.saveWorkHistory = async function(history) {
    // Não usado - sessões são salvas individualmente
    console.log('saveWorkHistory called - use API instead');
};

// ==================== FUNÇÕES ASYNC PARA DADOS ====================

window.loadAllDataAsync = async function() {
    await Promise.all([
        loadProjectsAsync(),
        loadUsersAsync(),
        loadHistoryAsync()
    ]);
};

window.refreshProjects = async function() {
    await loadProjectsAsync();
};

window.refreshHistory = async function() {
    await loadHistoryAsync();
};

// ==================== OVERRIDE: AUTHENTICATION ====================

const _originalRegister = window.register;
window.register = async function() {
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

    try {
        await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, firstName, lastName, defaultDepartment: department })
        });

        successDiv.textContent = 'Conta criada com sucesso! Pode fazer login.';
        successDiv.classList.remove('hidden');
        document.getElementById('regFirstName').value = '';
        document.getElementById('regLastName').value = '';
        document.getElementById('regDepartment').value = '';
        document.getElementById('regUsername').value = '';
        document.getElementById('regPassword').value = '';
        setTimeout(() => showLogin(), 2000);
    } catch (error) {
        errorDiv.textContent = error.message || 'Erro ao criar conta.';
        errorDiv.classList.remove('hidden');
    }
};

const _originalLogin = window.login;
window.login = async function() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    errorDiv.classList.add('hidden');

    if (!username || !password) {
        errorDiv.textContent = 'Por favor, preencha todos os campos.';
        errorDiv.classList.remove('hidden');
        return;
    }

    try {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        authToken = data.token;
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        invalidateCache();
        await loadAllDataAsync();
        
        showApp();
    } catch (error) {
        errorDiv.textContent = error.message || 'Utilizador ou password incorretos.';
        errorDiv.classList.remove('hidden');
    }
};

const _originalLogout = window.logout;
window.logout = function() {
    if (timerInterval) {
        showConfirm('Confirmar', 'Tem um timer ativo. Tem certeza que deseja sair?', function() {
            localStorage.removeItem('activeTimer');
            stopWork();
            doLogout();
        });
    } else {
        doLogout();
    }
};

function doLogout() {
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    invalidateCache();
    showLogin();
}

// ==================== OVERRIDE: SAVE SESSION ====================

window.saveWorkSession = async function(sessionData) {
    try {
        // Obter projectId se necessário
        if (sessionData.workCode && !sessionData.projectId) {
            const project = getProjectByCode(sessionData.workCode);
            if (project) sessionData.projectId = project.id;
        }

        await apiRequest('/sessions', {
            method: 'POST',
            body: JSON.stringify(sessionData)
        });
        
        invalidateCache();
        await loadHistoryAsync();
        return true;
    } catch (error) {
        console.error('Erro ao guardar sessão:', error);
        throw error;
    }
};

window.updateWorkSession = async function(sessionId, sessionData) {
    try {
        await apiRequest(`/sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify(sessionData)
        });
        invalidateCache();
        await loadHistoryAsync();
    } catch (error) {
        console.error('Erro ao atualizar sessão:', error);
        throw error;
    }
};

window.deleteWorkSession = async function(sessionId) {
    try {
        await apiRequest(`/sessions/${sessionId}`, { method: 'DELETE' });
        invalidateCache();
        await loadHistoryAsync();
    } catch (error) {
        console.error('Erro ao eliminar sessão:', error);
        throw error;
    }
};

// ==================== OVERRIDE: PROJECTS CRUD ====================

window.createProject = async function(workCode, name, notes) {
    try {
        const result = await apiRequest('/projects', {
            method: 'POST',
            body: JSON.stringify({ workCode, name, notes })
        });
        invalidateCache();
        await loadProjectsAsync();
        return result;
    } catch (error) {
        console.error('Erro ao criar projeto:', error);
        throw error;
    }
};

window.closeProject = async function(projectId) {
    try {
        await apiRequest(`/projects/${projectId}/close`, { method: 'PUT' });
        invalidateCache();
        await loadProjectsAsync();
    } catch (error) {
        console.error('Erro ao fechar projeto:', error);
        throw error;
    }
};

window.reopenProject = async function(projectId, reason, comment) {
    try {
        await apiRequest(`/projects/${projectId}/reopen`, {
            method: 'PUT',
            body: JSON.stringify({ reason, comment })
        });
        invalidateCache();
        await loadProjectsAsync();
    } catch (error) {
        console.error('Erro ao reabrir projeto:', error);
        throw error;
    }
};

// ==================== OVERRIDE: CALENDAR ====================

window.getCalendarData = async function(year) {
    try {
        return await apiRequest(`/calendar/${year}`);
    } catch (error) {
        console.error('Erro ao obter calendário:', error);
        return {};
    }
};

window.saveCalendarEntry = async function(date, type, note) {
    try {
        await apiRequest('/calendar', {
            method: 'POST',
            body: JSON.stringify({ date, type, note })
        });
    } catch (error) {
        console.error('Erro ao guardar calendário:', error);
        throw error;
    }
};

// ==================== OVERRIDE: COMMENTS ====================

window.getProjectComments = async function(projectId) {
    try {
        return await apiRequest(`/projects/${projectId}/comments`);
    } catch (error) {
        console.error('Erro ao obter comentários:', error);
        return [];
    }
};

window.addProjectComment = async function(projectId, comment) {
    try {
        await apiRequest(`/projects/${projectId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ comment })
        });
    } catch (error) {
        console.error('Erro ao adicionar comentário:', error);
        throw error;
    }
};

// ==================== OVERRIDE: ADMIN ====================

window.setUserAdmin = async function(userId, isAdmin) {
    try {
        await apiRequest(`/users/${userId}/admin`, {
            method: 'PUT',
            body: JSON.stringify({ isAdmin })
        });
        invalidateCache();
        await loadUsersAsync();
    } catch (error) {
        console.error('Erro ao alterar admin:', error);
        throw error;
    }
};

window.getAllUsersHistory = async function() {
    try {
        const sessions = await apiRequest('/sessions');
        return sessions;
    } catch (error) {
        console.error('Erro ao obter histórico:', error);
        return [];
    }
};

// ==================== INIT: CARREGAR DADOS AO INICIAR ====================

document.addEventListener('DOMContentLoaded', async function() {
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('currentUser');
    
    if (token && user) {
        authToken = token;
        try {
            await apiRequest('/users/me');
            await loadAllDataAsync();
            // O app.js vai chamar showApp() se tiver currentUser
        } catch (error) {
            // Token inválido
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        }
    }
});

console.log('✅ API Layer carregado - Servidor:', API_URL);
