function isUserAdmin() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    return user && user.isAdmin === true;
}

function initializeDefaultAdmin() {
    const users = getUsers();
    const adminExists = users.find(u => u.username === 'admin');
    
    if (!adminExists) {
        sha256('admin123').then(hashedPassword => {
            users.push({
                firstName: 'Admin',
                lastName: 'Sistema',
                username: 'admin',
                password: hashedPassword,
                defaultDepartment: '',
                isAdmin: true
            });
            saveUsers(users);
        });
    }
    
    migrateProjectsToGlobal();
}

function migrateProjectsToGlobal() {
    const globalProjects = localStorage.getItem('projects_global');
    if (globalProjects) {
        return; 
    }
    
    const users = getUsers();
    let allProjects = [];
    const seenCodes = new Set();
    
    users.forEach(user => {
        const key = `projects_${user.username}`;
        const userProjects = localStorage.getItem(key);
        if (userProjects) {
            const projects = JSON.parse(userProjects);
            projects.forEach(project => {
                if (!seenCodes.has(project.workCode)) {
                    seenCodes.add(project.workCode);
                    allProjects.push(project);
                }
            });
        }
    });
    
    if (allProjects.length > 0) {
        localStorage.setItem('projects_global', JSON.stringify(allProjects));
        console.log(`✅ Migração completa: ${allProjects.length} obras movidas para sistema global`);
    }
}

function getAllUsersHistory() {
    const users = getUsers();
    let allHistory = [];
    
    users.forEach(user => {
        const key = `workHistory_${user.username}`;
        const history = localStorage.getItem(key);
        if (history) {
            const userHistory = JSON.parse(history);
            allHistory = allHistory.concat(userHistory);
        }
    });
    
    return allHistory.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
}

function getAllUsersProjects() {
    const projects = localStorage.getItem('projects_global');
    return projects ? JSON.parse(projects) : [];
}

function loadUsersList() {
    if (!isUserAdmin()) return;
    
    const users = getUsers();
    const container = document.getElementById('usersList');
    
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem utilizadores registados</p>';
        return;
    }
    
    container.innerHTML = users.map(user => {
        const cardClass = user.isAdmin ? 'user-card admin-user' : 'user-card';
        const badgeHtml = user.isAdmin ? '<div class="user-badge">👑 ADMIN</div>' : '';
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const isSelf = currentUser.username === user.username;
        
        let actionsHtml = '';
        if (!isSelf) {
            if (user.isAdmin) {
                actionsHtml = `<button class="btn btn-secondary btn-small" onclick="demoteFromAdmin('${user.username}')">⬇️ Remover Admin</button>`;
            } else {
                actionsHtml = `<button class="btn btn-admin btn-small" onclick="promoteToAdmin('${user.username}')">⬆️ Promover a Admin</button>`;
            }
        } else {
            actionsHtml = '<span style="font-size: 12px; color: #95a5a6; font-style: italic;">Você</span>';
        }
        
        return `
            <div class="${cardClass}">
                <div class="user-header">
                    <div class="user-name">${user.firstName} ${user.lastName}</div>
                    ${badgeHtml}
                </div>
                <div class="user-info">👤 Username: ${user.username}</div>
                <div class="user-info">🏢 Departamento: ${getDepartmentName(user.defaultDepartment || 'N/A')}</div>
                <div class="user-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');
}

function promoteToAdmin(username) {
    if (!isUserAdmin()) {
        showAlert('Erro', 'Apenas administradores podem promover utilizadores.');
        return;
    }
    
    showConfirm('Promover a Admin', `Tem certeza que deseja promover "${username}" a Administrador?`, function() {
        const users = getUsers();
        const userIndex = users.findIndex(u => u.username === username);
        
        if (userIndex !== -1) {
            users[userIndex].isAdmin = true;
            saveUsers(users);
            
            showAlert('Sucesso', `${username} foi promovido a Administrador!`);
            loadUsersList();
        }
    });
}
      
function demoteFromAdmin(username) {
    if (!isUserAdmin()) {
        showAlert('Erro', 'Apenas administradores podem remover privilégios.');
        return;
    }
    
    showConfirm('Remover Admin', `Tem certeza que deseja remover privilégios de administrador de "${username}"?`, function() {
        const users = getUsers();
        const userIndex = users.findIndex(u => u.username === username);
        
        if (userIndex !== -1) {
            users[userIndex].isAdmin = false;
            saveUsers(users);
            
            showAlert('Sucesso', `Privilégios de administrador removidos de ${username}.`);
            loadUsersList();
        }
    });
}

function populateGlobalUserFilter() {
    if (!isUserAdmin()) return;
    
    const select = document.getElementById('globalUserFilter');
    if (!select) return;
    
    const users = getUsers();
    
    select.innerHTML = '<option value="all">Todos os Utilizadores</option>';
    users.forEach(user => {
        select.innerHTML += `<option value="${user.username}">${user.firstName} ${user.lastName}</option>`;
    });
}

function updateGlobalHistory() {
    if (!isUserAdmin()) return;
    
    const userFilter = document.getElementById('globalUserFilter').value;
    const typeFilter = document.getElementById('globalTypeFilter').value;
    const departmentFilter = document.getElementById('globalDepartmentFilter').value;
    
    const allHistory = getAllUsersHistory();
    
    const departmentFilterSection = document.getElementById('globalDepartmentFilterSection');
    if (typeFilter === 'project') {
        departmentFilterSection.classList.remove('hidden');
    } else {
        departmentFilterSection.classList.add('hidden');
    }
    
    let filteredHistory = allHistory;
    
    if (userFilter !== 'all') {
        filteredHistory = filteredHistory.filter(s => {
            const username = s.userName.toLowerCase().includes(userFilter) || 
                           (s.userName.includes(userFilter));
            const users = getUsers();
            const user = users.find(u => `${u.firstName} ${u.lastName}` === s.userName);
            return user && user.username === userFilter;
        });
    }
    
    if (typeFilter === 'project') {
        filteredHistory = filteredHistory.filter(s => s.workType === 'project');
        
        if (departmentFilter !== 'all') {
            filteredHistory = filteredHistory.filter(s => s.projectType === departmentFilter);
        }
    } else if (typeFilter === 'internal') {
        filteredHistory = filteredHistory.filter(s => s.workType === 'internal');
    }
    
    const projectSeconds = filteredHistory
        .filter(s => s.workType === 'project')
        .reduce((sum, s) => sum + s.duration, 0);
    
    const internalSeconds = filteredHistory
        .filter(s => s.workType === 'internal')
        .reduce((sum, s) => sum + s.duration, 0);
    
    document.getElementById('globalTotalProjectHours').textContent = formatHours(projectSeconds);
    document.getElementById('globalTotalInternalHours').textContent = formatHours(internalSeconds);
    
    const container = document.getElementById('globalHistoryList');
    
    if (filteredHistory.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem dados para mostrar</p>';
        return;
    }
    
    container.innerHTML = filteredHistory.slice(0, 50).map(session => {
        const date = new Date(session.startTime);
        const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        
        const commentHtml = session.comment ? 
            `<div class="hist-comment">💬 ${session.comment}</div>` : '';
        
        let badgesHtml = '';
        if (session.workType === 'internal') {
            badgesHtml += '<span class="hist-badge badge-internal">🏠 Interno</span>';
        }
        if (session.manualEntry) {
            badgesHtml += '<span class="hist-badge badge-manual">📝 Inserido Manualmente</span>';
        }
        if (session.manualEdit) {
            badgesHtml += '<span class="hist-badge badge-edited">✏️ Editado Manualmente</span>';
        }
        
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
            const workNameHtml = session.workName ? 
                `<div class="hist-obra">📋 ${session.workCode} - ${session.workName}</div>` : 
                `<div class="hist-obra">📋 ${session.workCode}</div>`;
            const subcategoryHtml = session.subcategory ? 
                `<div class="hist-obra">🏷️ ${session.subcategory}</div>` : '';
            subInfo = `${subcategoryHtml}${workNameHtml}`;
        }
        
        const itemClass = session.workType === 'internal' ? 'history-item internal' : 'history-item';
        
        return `
            <div class="${itemClass}">
                <div class="hist-user">👤 ${session.userName}</div>
                <div class="hist-project">${mainInfo} ${badgesHtml}</div>
                ${subInfo}
                <div class="hist-time">⏱️ ${formatDuration(session.duration)}</div>
                <div class="hist-date">${dateStr}</div>
                ${commentHtml}
            </div>
        `;
    }).join('');
}


function updateCompanyStats() {
    if (!isUserAdmin()) return;
    
    const users = getUsers();
    const allHistory = getAllUsersHistory();
    const allProjects = getAllUsersProjects();
    
    const totalHours = allHistory.reduce((sum, s) => sum + s.duration, 0);
    
    document.getElementById('companyTotalUsers').textContent = users.length;
    document.getElementById('companyTotalProjects').textContent = allProjects.length;
    document.getElementById('companyTotalSessions').textContent = allHistory.length;
    document.getElementById('companyTotalHours').textContent = formatHours(totalHours);
    
    const deptProjeto = allHistory.filter(s => s.projectType === 'projeto').reduce((sum, s) => sum + s.duration, 0);
    const deptEletrico = allHistory.filter(s => s.projectType === 'eletrico').reduce((sum, s) => sum + s.duration, 0);
    const deptDesenvolvimento = allHistory.filter(s => s.projectType === 'desenvolvimento').reduce((sum, s) => sum + s.duration, 0);
    const deptOrcamentacao = allHistory.filter(s => s.projectType === 'orcamentacao').reduce((sum, s) => sum + s.duration, 0);
    
    document.getElementById('deptProjetoHours').textContent = formatHours(deptProjeto);
    document.getElementById('deptEletricoHours').textContent = formatHours(deptEletrico);
    document.getElementById('deptDesenvolvimentoHours').textContent = formatHours(deptDesenvolvimento);
    document.getElementById('deptOrcamentacaoHours').textContent = formatHours(deptOrcamentacao);
    
    const internalReuniao = allHistory.filter(s => s.internalCategory === 'reuniao').reduce((sum, s) => sum + s.duration, 0);
    const internalFormacao = allHistory.filter(s => s.internalCategory === 'formacao').reduce((sum, s) => sum + s.duration, 0);
    
    document.getElementById('internalReuniaoHours').textContent = formatHours(internalReuniao);
    document.getElementById('internalFormacaoHours').textContent = formatHours(internalFormacao);
    
    let totalReopens = 0;
    let clientChangeReopens = 0;
    let ourErrorReopens = 0;
    const projectsWithReopens = [];
    
    allProjects.forEach(project => {
        if (project.reopenHistory && project.reopenHistory.length > 0) {
            const reopenCount = project.reopenHistory.length;
            totalReopens += reopenCount;
            
            project.reopenHistory.forEach(reopen => {
                if (reopen.reason === 'client_change') {
                    clientChangeReopens++;
                } else if (reopen.reason === 'our_error') {
                    ourErrorReopens++;
                }
            });
            
            projectsWithReopens.push({
                workCode: project.workCode,
                name: project.name,
                reopenCount: reopenCount,
                history: project.reopenHistory
            });
        }
    });
    
    const reopenPercentage = allProjects.length > 0 ? ((projectsWithReopens.length / allProjects.length) * 100).toFixed(1) : 0;
    
    document.getElementById('totalReopens').textContent = totalReopens;
    document.getElementById('clientChangeReopens').textContent = clientChangeReopens;
    document.getElementById('ourErrorReopens').textContent = ourErrorReopens;
    document.getElementById('reopenPercentage').textContent = `${reopenPercentage}%`;

    const reopenContainer = document.getElementById('reopenDetailsBreakdown');
    if (projectsWithReopens.length === 0) {
        reopenContainer.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Nenhuma obra foi reaberta</p>';
    } else {
        reopenContainer.innerHTML = projectsWithReopens.sort((a, b) => b.reopenCount - a.reopenCount).map(project => {
            const reopensHtml = project.history.map(reopen => {
                const date = new Date(reopen.date);
                const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
                const reasonText = reopen.reason === 'client_change' ? '🟡 Alteração do Cliente' : '🔴 Erro Nosso';
                const reasonColor = reopen.reason === 'client_change' ? '#f39c12' : '#e74c3c';
                return `<div style="font-size: 12px; margin: 3px 0; padding-left: 10px;">
                    <span style="color: ${reasonColor}; font-weight: 600;">${reasonText}</span> - ${dateStr}
                    ${reopen.comment ? `<br><em style="color: #6c757d; padding-left: 10px;">"${reopen.comment}"</em>` : ''}
                </div>`;
            }).join('');
            
            return `
                <div class="history-item">
                    <div class="hist-project">📋 ${project.workCode} - ${project.name} <span class="hist-badge badge-edited">${project.reopenCount}x reabertas</span></div>
                    ${reopensHtml}
                </div>
            `;
        }).join('');
    }
    
    const userStats = users.map(user => {
        const userHistory = allHistory.filter(s => {
            const fullName = `${user.firstName} ${user.lastName}`;
            return s.userName === fullName;
        });
        
        const totalSeconds = userHistory.reduce((sum, s) => sum + s.duration, 0);
        const projectSeconds = userHistory.filter(s => s.workType === 'project').reduce((sum, s) => sum + s.duration, 0);
        const internalSeconds = userHistory.filter(s => s.workType === 'internal').reduce((sum, s) => sum + s.duration, 0);
        
        return {
            name: `${user.firstName} ${user.lastName}`,
            username: user.username,
            isAdmin: user.isAdmin,
            totalHours: formatHours(totalSeconds),
            projectHours: formatHours(projectSeconds),
            internalHours: formatHours(internalSeconds),
            sessions: userHistory.length
        };
    }).sort((a, b) => {
        const aHours = parseFloat(a.totalHours);
        const bHours = parseFloat(b.totalHours);
        return bHours - aHours;
    });
    
    const container = document.getElementById('userStatsBreakdown');
    
    if (userStats.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem dados de utilizadores</p>';
        return;
    }
    
    container.innerHTML = userStats.map(stat => {
        const adminBadge = stat.isAdmin ? '<span class="hist-badge" style="background: var(--admin-color); color: white;">👑 ADMIN</span>' : '';
        
        return `
            <div class="history-item">
                <div class="hist-project">👤 ${stat.name} ${adminBadge}</div>
                <div class="hist-obra">📊 Total: ${stat.totalHours} | 🏢 Projeto: ${stat.projectHours} | 🏠 Interno: ${stat.internalHours}</div>
                <div class="hist-date">📝 ${stat.sessions} sessões registadas</div>
            </div>
        `;
    }).join('');
}

function setupAdminUI() {
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
        
        const adminTabs = document.querySelectorAll('.admin-tab');
        adminTabs.forEach(tab => tab.classList.remove('hidden'));
        
        const adminOnlyTabs = document.querySelectorAll('.admin-only-tab');
        adminOnlyTabs.forEach(tab => tab.classList.remove('hidden'));
        
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.classList.remove('hidden');
        }
        
        populateGlobalUserFilter();
        populateTeamUserFilter();
    } else {
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.classList.add('hidden');
        }
        
        const adminOnlyTabs = document.querySelectorAll('.admin-only-tab');
        adminOnlyTabs.forEach(tab => tab.classList.add('hidden'));
    }
}

function populateTeamUserFilter() {
    if (!isUserAdmin()) return;
    
    const select = document.getElementById('teamUserFilter');
    if (!select) return;
    
    const users = getUsers();
    
    select.innerHTML = '<option value="all">Todos os Utilizadores</option>';
    users.forEach(user => {
        select.innerHTML += `<option value="${user.username}">${user.firstName} ${user.lastName}</option>`;
    });
}

function getTeamHoursFilters() {
    const userFilter = document.getElementById('teamUserFilter')?.value || 'all';
    const periodFilter = document.getElementById('teamPeriodFilter')?.value || 'week';
    const workTypeFilter = document.getElementById('teamWorkTypeFilter')?.value || 'all';
    const departmentFilter = document.getElementById('teamDepartmentFilter')?.value || 'all';
    const dateFrom = document.getElementById('teamDateFrom')?.value || '';
    const dateTo = document.getElementById('teamDateTo')?.value || '';
    
    const now = new Date();
    let startDate, endDate;
    
    switch(periodFilter) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
            break;
        case 'week':
            const dayOfWeek = now.getDay();
            const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
            endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6, 23, 59, 59);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
        case 'custom':
            startDate = dateFrom ? new Date(dateFrom) : new Date(0);
            endDate = dateTo ? new Date(dateTo + 'T23:59:59') : new Date();
            break;
    }
    
    return {
        userFilter,
        periodFilter,
        workTypeFilter,
        departmentFilter,
        startDate,
        endDate
    };
}

function toggleCustomDateFields() {
    const periodFilter = document.getElementById('teamPeriodFilter')?.value || 'week';
    const fromGroup = document.getElementById('teamCustomDateGroup');
    const toGroup = document.getElementById('teamCustomDateToGroup');
    
    if (periodFilter === 'custom') {
        if (fromGroup) fromGroup.style.display = 'flex';
        if (toGroup) toGroup.style.display = 'flex';
    } else {
        if (fromGroup) fromGroup.style.display = 'none';
        if (toGroup) toGroup.style.display = 'none';
    }
}

function updateTeamHoursView() {
    if (!isUserAdmin()) return;
    
    toggleCustomDateFields();
    
    const filters = getTeamHoursFilters();
    const allHistory = getAllUsersHistory();
    const users = getUsers();
    
    let filteredHistory = allHistory.filter(session => {
        const sessionDate = new Date(session.startTime);
        
        if (sessionDate < filters.startDate || sessionDate > filters.endDate) {
            return false;
        }
        
        if (filters.userFilter !== 'all') {
            const user = users.find(u => `${u.firstName} ${u.lastName}` === session.userName);
            if (!user || user.username !== filters.userFilter) {
                return false;
            }
        }
        
        if (filters.workTypeFilter !== 'all') {
            if (session.workType !== filters.workTypeFilter) {
                return false;
            }
        }
        
        if (filters.departmentFilter !== 'all' && session.workType === 'project') {
            if (session.projectType !== filters.departmentFilter) {
                return false;
            }
        }
        
        return true;
    });
    
    const totalSeconds = filteredHistory.reduce((sum, s) => sum + s.duration, 0);
    const projectSeconds = filteredHistory.filter(s => s.workType === 'project').reduce((sum, s) => sum + s.duration, 0);
    const internalSeconds = filteredHistory.filter(s => s.workType === 'internal').reduce((sum, s) => sum + s.duration, 0);
    
    document.getElementById('teamTotalHours').textContent = formatHoursMinutes(totalSeconds);
    document.getElementById('teamProjectHours').textContent = formatHoursMinutes(projectSeconds);
    document.getElementById('teamInternalHours').textContent = formatHoursMinutes(internalSeconds);
    document.getElementById('teamTotalSessions').textContent = filteredHistory.length;
    
    const userStats = {};
    filteredHistory.forEach(session => {
        const userName = session.userName;
        if (!userStats[userName]) {
            userStats[userName] = {
                name: userName,
                total: 0,
                project: 0,
                internal: 0,
                sessions: 0,
                isAdmin: false
            };
            
            const user = users.find(u => `${u.firstName} ${u.lastName}` === userName);
            if (user) {
                userStats[userName].isAdmin = user.isAdmin;
                userStats[userName].username = user.username;
            }
        }
        
        userStats[userName].total += session.duration;
        userStats[userName].sessions++;
        
        if (session.workType === 'project') {
            userStats[userName].project += session.duration;
        } else {
            userStats[userName].internal += session.duration;
        }
    });
    
    const userStatsArray = Object.values(userStats).sort((a, b) => b.total - a.total);
    

    renderTeamHoursTable(userStatsArray);
    
    renderTeamSessionsList(filteredHistory);
}

function renderTeamHoursTable(userStats) {
    const container = document.getElementById('teamHoursTable');
    if (!container) return;
    
    if (userStats.length === 0) {
        container.innerHTML = `
            <div class="empty-team-data">
                <div class="empty-icon">📊</div>
                <p>Sem dados para o período selecionado</p>
                <p style="font-size: 12px; margin-top: 10px;">Experimente alterar os filtros ou selecionar um período diferente</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="team-hours-row header">
            <div>Utilizador</div>
            <div style="text-align: center;">🏢 Projeto</div>
            <div style="text-align: center;">🏠 Interno</div>
            <div style="text-align: center;">⏱️ Total</div>
            <div style="text-align: center;">📝 Sessões</div>
        </div>
    `;
    
    userStats.forEach(stat => {
        const initials = stat.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        const adminClass = stat.isAdmin ? 'admin' : '';
        
        html += `
            <div class="team-hours-row expandable" onclick="toggleUserDetails('${stat.username || stat.name}')">
                <div class="user-name-col">
                    <div class="user-avatar ${adminClass}">${initials}</div>
                    <span>${stat.name}</span>
                    ${stat.isAdmin ? '<span class="hist-badge" style="background: var(--admin-color); color: white; font-size: 10px; padding: 2px 6px; margin-left: 8px;">ADMIN</span>' : ''}
                </div>
                <div class="hours-col project">${formatHoursMinutes(stat.project)}</div>
                <div class="hours-col internal">${formatHoursMinutes(stat.internal)}</div>
                <div class="hours-col total">${formatHoursMinutes(stat.total)}</div>
                <div class="sessions-col">${stat.sessions}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function toggleUserDetails(userId) {
    console.log('Toggle details for:', userId);
}

function renderTeamSessionsList(sessions) {
    const container = document.getElementById('teamSessionsList');
    if (!container) return;
    
    if (sessions.length === 0) {
        container.innerHTML = `
            <div class="empty-team-data">
                <div class="empty-icon">📋</div>
                <p>Sem sessões para o período selecionado</p>
                <p style="font-size: 12px; margin-top: 10px;">As sessões registadas pelos utilizadores aparecerão aqui</p>
            </div>
        `;
        return;
    }
    
    const displaySessions = sessions.slice(0, 100);
    
    container.innerHTML = displaySessions.map(session => {
        const date = new Date(session.startTime);
        const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        const commentHtml = session.comment ? 
            `<div class="hist-comment">💬 ${session.comment}</div>` : '';
        
        let badgesHtml = '';
        if (session.workType === 'internal') {
            badgesHtml += '<span class="hist-badge badge-internal">🏠 Interno</span>';
        }
        if (session.manualEntry) {
            badgesHtml += '<span class="hist-badge badge-manual">📝 Manual</span>';
        }
        if (session.manualEdit) {
            badgesHtml += '<span class="hist-badge badge-edited">✏️ Editado</span>';
        }
        
        let mainInfo = '';
        let subInfo = '';
        
        if (session.workType === 'internal') {
            mainInfo = session.internalCategoryName || 'Trabalho Interno';
            subInfo = `<div class="hist-obra">📝 ${session.internalDescription || ''}</div>`;
        } else {
            mainInfo = session.projectName || 'Projeto';
            const workNameHtml = session.workName ? 
                `<div class="hist-obra">📋 ${session.workCode} - ${session.workName}</div>` : 
                `<div class="hist-obra">📋 ${session.workCode || ''}</div>`;
            const subcategoryHtml = session.subcategory ? 
                `<div class="hist-obra">🏷️ ${session.subcategory}</div>` : '';
            subInfo = `${subcategoryHtml}${workNameHtml}`;
        }
        
        const itemClass = session.workType === 'internal' ? 'history-item internal' : 'history-item';
        
        return `
            <div class="${itemClass}">
                <div class="hist-user">👤 ${session.userName}</div>
                <div class="hist-project">${mainInfo} ${badgesHtml}</div>
                ${subInfo}
                <div class="hist-time">⏱️ ${formatDuration(session.duration)}</div>
                <div class="hist-date">${dateStr}</div>
                ${commentHtml}
            </div>
        `;
    }).join('');
    
    if (sessions.length > 100) {
        container.innerHTML += `
            <div class="info-panel" style="margin-top: 15px; text-align: center;">
                <p style="color: #6c757d; font-size: 12px;">
                    A mostrar as primeiras 100 de ${sessions.length} sessões. 
                    Exporte para CSV para ver todas.
                </p>
            </div>
        `;
    }
}

function formatHoursMinutes(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}


function exportTeamHoursCSV() {
    if (!isUserAdmin()) return;
    
    const filters = getTeamHoursFilters();
    const allHistory = getAllUsersHistory();
    const users = getUsers();
    
    let filteredHistory = allHistory.filter(session => {
        const sessionDate = new Date(session.startTime);
        
        if (sessionDate < filters.startDate || sessionDate > filters.endDate) {
            return false;
        }
        
        if (filters.userFilter !== 'all') {
            const user = users.find(u => `${u.firstName} ${u.lastName}` === session.userName);
            if (!user || user.username !== filters.userFilter) {
                return false;
            }
        }
        
        if (filters.workTypeFilter !== 'all') {
            if (session.workType !== filters.workTypeFilter) {
                return false;
            }
        }
        
        if (filters.departmentFilter !== 'all' && session.workType === 'project') {
            if (session.projectType !== filters.departmentFilter) {
                return false;
            }
        }
        
        return true;
    });
    
    let csv = 'Utilizador,Data,Hora Início,Hora Fim,Duração (h),Tipo,Departamento,Código Obra,Nome Obra,Subcategoria,Descrição,Comentário\n';
    
    filteredHistory.forEach(session => {
        const startDate = new Date(session.startTime);
        const endDate = new Date(session.endTime);
        
        const dateStr = `${startDate.getDate().toString().padStart(2, '0')}/${(startDate.getMonth() + 1).toString().padStart(2, '0')}/${startDate.getFullYear()}`;
        const startTimeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
        const endTimeStr = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
        const durationHours = (session.duration / 3600).toFixed(2);
        
        const tipo = session.workType === 'internal' ? 'Interno' : 'Projeto';
        const departamento = session.workType === 'project' ? (getDepartmentName(session.projectType) || '') : '';
        const codigoObra = session.workCode || '';
        const nomeObra = session.workName || '';
        const subcategoria = session.subcategory || '';
        const descricao = session.workType === 'internal' ? (session.internalDescription || '') : '';
        const comentario = session.comment || '';
        
        csv += `"${session.userName}","${dateStr}","${startTimeStr}","${endTimeStr}","${durationHours}","${tipo}","${departamento}","${codigoObra}","${nomeObra}","${subcategoria}","${descricao}","${comentario}"\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const periodLabel = filters.periodFilter === 'custom' ? 'personalizado' : filters.periodFilter;
    link.download = `horas_equipa_${periodLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function exportTeamHoursJSON() {
    if (!isUserAdmin()) return;
    
    const filters = getTeamHoursFilters();
    const allHistory = getAllUsersHistory();
    const users = getUsers();
    
    let filteredHistory = allHistory.filter(session => {
        const sessionDate = new Date(session.startTime);
        
        if (sessionDate < filters.startDate || sessionDate > filters.endDate) {
            return false;
        }
        
        if (filters.userFilter !== 'all') {
            const user = users.find(u => `${u.firstName} ${u.lastName}` === session.userName);
            if (!user || user.username !== filters.userFilter) {
                return false;
            }
        }
        
        if (filters.workTypeFilter !== 'all') {
            if (session.workType !== filters.workTypeFilter) {
                return false;
            }
        }
        
        if (filters.departmentFilter !== 'all' && session.workType === 'project') {
            if (session.projectType !== filters.departmentFilter) {
                return false;
            }
        }
        
        return true;
    });
    
    const exportData = {
        exportDate: new Date().toISOString(),
        filters: {
            user: filters.userFilter,
            period: filters.periodFilter,
            workType: filters.workTypeFilter,
            department: filters.departmentFilter,
            startDate: filters.startDate.toISOString(),
            endDate: filters.endDate.toISOString()
        },
        summary: {
            totalSessions: filteredHistory.length,
            totalHours: (filteredHistory.reduce((sum, s) => sum + s.duration, 0) / 3600).toFixed(2),
            projectHours: (filteredHistory.filter(s => s.workType === 'project').reduce((sum, s) => sum + s.duration, 0) / 3600).toFixed(2),
            internalHours: (filteredHistory.filter(s => s.workType === 'internal').reduce((sum, s) => sum + s.duration, 0) / 3600).toFixed(2)
        },
        sessions: filteredHistory
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const periodLabel = filters.periodFilter === 'custom' ? 'personalizado' : filters.periodFilter;
    link.download = `horas_equipa_${periodLabel}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

function loadAdminUsersList() {
    if (!isUserAdmin()) return;
    
    const users = getUsers();
    const allHistory = getAllUsersHistory();
    const container = document.getElementById('adminUsersList');
    
    if (!container) return;
    
    const adminCount = users.filter(u => u.isAdmin).length;
    const regularCount = users.length - adminCount;
    
    document.getElementById('totalUsersCount').textContent = users.length;
    document.getElementById('adminUsersCount').textContent = adminCount;
    document.getElementById('regularUsersCount').textContent = regularCount;
    
    if (users.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 20px;">Sem utilizadores registados</p>';
        return;
    }
    
    const userStatsMap = {};
    allHistory.forEach(session => {
        const userName = session.userName;
        if (!userStatsMap[userName]) {
            userStatsMap[userName] = { total: 0, project: 0, internal: 0, sessions: 0 };
        }
        userStatsMap[userName].total += session.duration;
        userStatsMap[userName].sessions++;
        if (session.workType === 'project') {
            userStatsMap[userName].project += session.duration;
        } else {
            userStatsMap[userName].internal += session.duration;
        }
    });
    
    container.innerHTML = users.map(user => {
        const cardClass = user.isAdmin ? 'user-card admin-user' : 'user-card';
        const badgeHtml = user.isAdmin ? '<div class="user-badge">👑 ADMIN</div>' : '';
        
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        const isSelf = currentUser.username === user.username;
        
        const fullName = `${user.firstName} ${user.lastName}`;
        const stats = userStatsMap[fullName] || { total: 0, project: 0, internal: 0, sessions: 0 };
        
        let actionsHtml = '';
        if (!isSelf) {
            if (user.isAdmin) {
                actionsHtml = `
                    <button class="btn btn-secondary btn-small" onclick="demoteFromAdmin('${user.username}')">⬇️ Remover Admin</button>
                    <button class="btn btn-danger btn-small" onclick="confirmDeleteUser('${user.username}')">🗑️ Eliminar</button>
                `;
            } else {
                actionsHtml = `
                    <button class="btn btn-admin btn-small" onclick="promoteToAdmin('${user.username}')">⬆️ Promover a Admin</button>
                    <button class="btn btn-danger btn-small" onclick="confirmDeleteUser('${user.username}')">🗑️ Eliminar</button>
                `;
            }
        } else {
            actionsHtml = '<span style="font-size: 12px; color: #95a5a6; font-style: italic;">Você</span>';
        }
        
        return `
            <div class="${cardClass}">
                <div class="user-header">
                    <div class="user-name">${fullName}</div>
                    ${badgeHtml}
                </div>
                <div class="user-info">👤 Username: ${user.username}</div>
                <div class="user-info">🏢 Departamento: ${getDepartmentName(user.defaultDepartment || 'N/A')}</div>
                <div class="user-stats">
                    <div class="user-stat">
                        <div class="user-stat-value">${formatHoursMinutes(stats.total)}</div>
                        <div class="user-stat-label">Total Horas</div>
                    </div>
                    <div class="user-stat">
                        <div class="user-stat-value" style="color: var(--secondary-color);">${formatHoursMinutes(stats.project)}</div>
                        <div class="user-stat-label">🏢 Projeto</div>
                    </div>
                    <div class="user-stat">
                        <div class="user-stat-value" style="color: var(--internal-color);">${formatHoursMinutes(stats.internal)}</div>
                        <div class="user-stat-label">🏠 Interno</div>
                    </div>
                </div>
                <div class="user-info">📝 ${stats.sessions} sessões registadas</div>
                <div class="user-actions">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }).join('');
}

// Confirmar eliminação de utilizador
function confirmDeleteUser(username) {
    const users = getUsers();
    const user = users.find(u => u.username === username);
    if (!user) return;
    
    const fullName = `${user.firstName} ${user.lastName}`;
    
    showConfirm(
        '⚠️ Eliminar Utilizador',
        `Tem certeza que deseja eliminar a conta de "${fullName}" (${username})?\n\nTodo o histórico de trabalho deste utilizador será mantido, mas a conta será removida.`,
        function() {
            deleteUser(username);
        }
    );
}

// Eliminar utilizador
function deleteUser(username) {
    const users = getUsers();
    const userIndex = users.findIndex(u => u.username === username);
    
    if (userIndex === -1) {
        showAlert('Erro', 'Utilizador não encontrado.');
        return;
    }
    
    const user = users[userIndex];
    
    // Não permitir eliminar a própria conta
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser.username === username) {
        showAlert('Erro', 'Não pode eliminar a sua própria conta.');
        return;
    }
    
    // Remover utilizador
    users.splice(userIndex, 1);
    saveUsers(users);
    
    // Atualizar lista
    loadAdminUsersList();
    
    showAlert('Sucesso', `A conta de ${user.firstName} ${user.lastName} foi eliminada.`);
}

let adminCalendarYear = new Date().getFullYear();
let selectedUserForCalendar = null;

function populateTeamCalendarUserFilter() {
    if (!isUserAdmin()) return;
    
    const select = document.getElementById('teamCalendarUserFilter');
    if (!select) return;
    
    const users = getUsers();
    
    select.innerHTML = '<option value="">Selecione um utilizador</option>';
    users.forEach(user => {
        select.innerHTML += `<option value="${user.username}">${user.firstName} ${user.lastName}</option>`;
    });
}

function loadTeamCalendarView() {
    if (!isUserAdmin()) return;
    
    const username = document.getElementById('teamCalendarUserFilter').value;
    
    if (!username) {
        document.getElementById('teamCalendarContainer').innerHTML = `
            <div class="empty-calendar-message">
                <span style="font-size: 48px;">📅</span>
                <p>Selecione um utilizador para ver o calendário</p>
            </div>
        `;
        document.getElementById('teamCalendarStats').classList.add('hidden');
        return;
    }
    
    selectedUserForCalendar = username;
    document.getElementById('teamCalendarStats').classList.remove('hidden');
    renderTeamCalendar(adminCalendarYear, username);
}

function getUserCalendarData(year, username) {
    const key = `calendar_${year}_${username}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : {};
}

function getUserWorkHistory(username) {
    const key = `workHistory_${username}`;
    const history = localStorage.getItem(key);
    return history ? JSON.parse(history) : [];
}

function hasUserWorkedOnDay(dateStr, username) {
    const history = getUserWorkHistory(username);
    return history.some(session => {
        const sessionDate = new Date(session.startTime);
        return formatDateKey(sessionDate) === dateStr;
    });
}

function getTeamDayInfo(dateStr, username) {
    const calendarData = getUserCalendarData(adminCalendarYear, username);
    const date = new Date(dateStr + 'T00:00:00');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    const isFutureDate = checkDate > today;
    
    if (calendarData[dateStr]) {
        const entry = calendarData[dateStr];
        if (entry.type === 'vacation') {
            return { type: 'vacation', color: 'vacation', icon: '🏖️', note: entry.note };
        }
        if (entry.type === 'absence') {
            return { type: 'absence', color: 'absence', icon: '❌', note: entry.note };
        }
        if (entry.type === 'worked') {
            return { type: 'worked', color: 'worked', icon: '💼', note: entry.note || '' };
        }
    }
    
    const holiday = isHoliday(dateStr);
    if (holiday) {
        return { type: 'holiday', color: 'holiday', icon: '🎉', note: holiday };
    }
    
    if (isWeekend(date)) {
        return { type: 'weekend', color: 'weekend', icon: '🏠', note: '' };
    }
    
    if (isFutureDate) {
        return { type: 'future', color: 'empty', icon: '', note: '' };
    }
    
    if (hasUserWorkedOnDay(dateStr, username)) {
        return { type: 'worked', color: 'worked', icon: '💼', note: '' };
    }
    
    if (checkDate <= yesterday) {
        return { type: 'auto-absence', color: 'auto-absence', icon: '⚠️', note: 'Falta (sem registo)' };
    }
    
    return { type: 'empty', color: 'empty', icon: '', note: '' };
}

function renderTeamCalendar(year, username) {
    adminCalendarYear = year;
    const container = document.getElementById('teamCalendarContainer');
    if (!container) return;
    
    const users = getUsers();
    const user = users.find(u => u.username === username);
    const userName = user ? `${user.firstName} ${user.lastName}` : username;
    
    document.getElementById('teamCalendarUserName').textContent = userName;
    document.getElementById('teamCalendarYearDisplay').textContent = year;
    
    container.innerHTML = '';
    
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    let workedDays = 0;
    let vacationDays = 0;
    let absenceDays = 0;
    let holidayDays = 0;
    let weekendDays = 0;
    
    months.forEach((monthName, monthIndex) => {
        const monthCard = document.createElement('div');
        monthCard.className = 'month-card';
        
        const monthHeader = document.createElement('div');
        monthHeader.className = 'month-header';
        monthHeader.textContent = monthName;
        monthCard.appendChild(monthHeader);
        
        const daysHeader = document.createElement('div');
        daysHeader.className = 'month-days-header';
        ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.textContent = day;
            daysHeader.appendChild(dayEl);
        });
        monthCard.appendChild(daysHeader);
        
        const daysGrid = document.createElement('div');
        daysGrid.className = 'month-days-grid';
        
        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        for (let i = 0; i < startingDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'month-day empty';
            daysGrid.appendChild(emptyDay);
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, monthIndex, day);
            const dateStr = formatDateKey(date);
            const dayInfo = getTeamDayInfo(dateStr, username);
            
            const dayEl = document.createElement('div');
            dayEl.className = `month-day day-${dayInfo.color}`;
            dayEl.textContent = day;
            
            const today = new Date();
            if (date.toDateString() === today.toDateString()) {
                dayEl.classList.add('today');
            }
            
            if (dayInfo.icon) {
                const icon = document.createElement('div');
                icon.className = 'day-icon-mini';
                icon.textContent = dayInfo.icon;
                dayEl.appendChild(icon);
            }
            
            dayEl.onclick = () => openTeamDayModal(dateStr, dayInfo, userName);
            
            daysGrid.appendChild(dayEl);
            
            switch(dayInfo.type) {
                case 'worked': workedDays++; break;
                case 'vacation': vacationDays++; break;
                case 'absence': 
                case 'auto-absence': absenceDays++; break;
                case 'holiday': holidayDays++; break;
                case 'weekend': weekendDays++; break;
            }
        }
        
        monthCard.appendChild(daysGrid);
        container.appendChild(monthCard);
    });
    
    const totalDays = 365 + (year % 4 === 0 ? 1 : 0);
    const remainingDays = totalDays - workedDays - vacationDays - absenceDays - holidayDays - weekendDays;
    
    document.getElementById('teamStatWorkedDays').textContent = workedDays;
    document.getElementById('teamStatVacationDays').textContent = vacationDays;
    document.getElementById('teamStatAbsenceDays').textContent = absenceDays;
    document.getElementById('teamStatHolidayDays').textContent = holidayDays;
    document.getElementById('teamStatWeekendDays').textContent = weekendDays;
    document.getElementById('teamStatRemainingDays').textContent = remainingDays;
}

function openTeamDayModal(dateStr, dayInfo, userName) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()];
    const dayNum = date.getDate();
    const monthName = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][date.getMonth()];
    
    document.getElementById('teamModalUserName').textContent = userName;
    document.getElementById('teamModalDayDate').textContent = `${dayName}, ${dayNum} de ${monthName} de ${adminCalendarYear}`;
    
    const contentDiv = document.getElementById('teamModalDayContent');
    let statusHtml = '';
    
    if (dayInfo.type === 'vacation') {
        statusHtml = `
            <div class="day-status vacation-status">
                <span class="status-icon">🏖️</span>
                <span class="status-text">Férias</span>
            </div>
            ${dayInfo.note ? `<div class="day-note">📝 ${dayInfo.note}</div>` : ''}
        `;
    } else if (dayInfo.type === 'absence') {
        statusHtml = `
            <div class="day-status absence-status">
                <span class="status-icon">❌</span>
                <span class="status-text">Falta</span>
            </div>
            ${dayInfo.note ? `<div class="day-note">📝 ${dayInfo.note}</div>` : ''}
        `;
    } else if (dayInfo.type === 'auto-absence') {
        statusHtml = `
            <div class="day-status auto-absence-status">
                <span class="status-icon">⚠️</span>
                <span class="status-text">Falta (sem registo)</span>
            </div>
            <div class="day-note">Não há registos de trabalho neste dia</div>
        `;
    } else if (dayInfo.type === 'holiday') {
        statusHtml = `
            <div class="day-status holiday-status">
                <span class="status-icon">🎉</span>
                <span class="status-text">Feriado</span>
            </div>
            <div class="day-note">📅 ${dayInfo.note}</div>
        `;
    } else if (dayInfo.type === 'weekend') {
        statusHtml = `
            <div class="day-status weekend-status">
                <span class="status-icon">🏠</span>
                <span class="status-text">Domingo</span>
            </div>
        `;
    } else if (dayInfo.type === 'worked') {
        const sessions = getTeamDaySessions(dateStr);
        const totalSeconds = sessions.reduce((sum, s) => sum + s.duration, 0);
        
        statusHtml = `
            <div class="day-status worked-status">
                <span class="status-icon">💼</span>
                <span class="status-text">Dia Trabalhado</span>
            </div>
            <div class="day-note">⏱️ Total: ${formatDuration(totalSeconds)}</div>
            <div class="day-sessions-list">
                ${sessions.map(s => {
                    const startTime = new Date(s.startTime);
                    const timeStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`;
                    const typeIcon = s.workType === 'internal' ? '🏠' : '🏢';
                    const typeName = s.workType === 'internal' ? (s.internalCategoryName || 'Interno') : (s.workCode || 'Projeto');
                    return `<div class="day-session-item">${typeIcon} ${timeStr} - ${typeName} (${formatDuration(s.duration)})</div>`;
                }).join('')}
            </div>
        `;
    } else {
        statusHtml = `
            <div class="day-status future-status">
                <span class="status-icon">📆</span>
                <span class="status-text">Dia Futuro</span>
            </div>
        `;
    }
    
    contentDiv.innerHTML = statusHtml;
    
    document.getElementById('teamDayModal').classList.add('show');
}

function getTeamDaySessions(dateStr) {
    if (!selectedUserForCalendar) return [];
    
    const history = getUserWorkHistory(selectedUserForCalendar);
    return history.filter(session => {
        const sessionDate = new Date(session.startTime);
        return formatDateKey(sessionDate) === dateStr;
    });
}

function closeTeamDayModal() {
    document.getElementById('teamDayModal').classList.remove('show');
}

function changeTeamCalendarYear(delta) {
    const todayYear = new Date().getFullYear();
    const newYear = adminCalendarYear + delta;
    
    if (newYear < todayYear - 5) {
        return;
    }
    
    adminCalendarYear = newYear;
    if (selectedUserForCalendar) {
        renderTeamCalendar(adminCalendarYear, selectedUserForCalendar);
    }
}

function goToTeamCurrentYear() {
    adminCalendarYear = new Date().getFullYear();
    if (selectedUserForCalendar) {
        renderTeamCalendar(adminCalendarYear, selectedUserForCalendar);
    }
}

function exportTeamCalendarCSV() {
    if (!isUserAdmin() || !selectedUserForCalendar) return;
    
    const users = getUsers();
    const user = users.find(u => u.username === selectedUserForCalendar);
    const userName = user ? `${user.firstName} ${user.lastName}` : selectedUserForCalendar;
    
    let csv = 'Data,Dia da Semana,Estado,Nota\n';
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    for (let month = 0; month < 12; month++) {
        const lastDay = new Date(adminCalendarYear, month + 1, 0).getDate();
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(adminCalendarYear, month, day);
            const dateStr = formatDateKey(date);
            const dayInfo = getTeamDayInfo(dateStr, selectedUserForCalendar);
            
            const dateFormatted = `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${adminCalendarYear}`;
            const dayName = dayNames[date.getDay()];
            
            let estado = '';
            switch(dayInfo.type) {
                case 'worked': estado = 'Trabalhado'; break;
                case 'vacation': estado = 'Férias'; break;
                case 'absence': estado = 'Falta'; break;
                case 'auto-absence': estado = 'Falta (sem registo)'; break;
                case 'holiday': estado = 'Feriado'; break;
                case 'weekend': estado = 'Domingo'; break;
                case 'future': estado = 'Futuro'; break;
                default: estado = '-';
            }
            
            const nota = dayInfo.note ? `"${dayInfo.note.replace(/"/g, '""')}"` : '';
            
            csv += `${dateFormatted},${dayName},${estado},${nota}\n`;
        }
    }
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `calendario_${userName.replace(/\s+/g, '_')}_${adminCalendarYear}.csv`;
    link.click();
}

function exportAllTeamCalendarsCSV() {
    if (!isUserAdmin()) return;
    
    const users = getUsers();
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    let csv = 'Utilizador,Data,Dia da Semana,Estado,Nota\n';
    
    users.forEach(user => {
        for (let month = 0; month < 12; month++) {
            const lastDay = new Date(adminCalendarYear, month + 1, 0).getDate();
            for (let day = 1; day <= lastDay; day++) {
                const date = new Date(adminCalendarYear, month, day);
                const dateStr = formatDateKey(date);
                const dayInfo = getTeamDayInfo(dateStr, user.username);
                
                const dateFormatted = `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}/${adminCalendarYear}`;
                const dayName = dayNames[date.getDay()];
                const userName = `${user.firstName} ${user.lastName}`;
                
                let estado = '';
                switch(dayInfo.type) {
                    case 'worked': estado = 'Trabalhado'; break;
                    case 'vacation': estado = 'Férias'; break;
                    case 'absence': estado = 'Falta'; break;
                    case 'auto-absence': estado = 'Falta (sem registo)'; break;
                    case 'holiday': estado = 'Feriado'; break;
                    case 'weekend': estado = 'Domingo'; break;
                    case 'future': estado = 'Futuro'; break;
                    default: estado = '-';
                }
                
                const nota = dayInfo.note ? `"${dayInfo.note.replace(/"/g, '""')}"` : '';
                
                csv += `"${userName}",${dateFormatted},${dayName},${estado},${nota}\n`;
            }
        }
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `calendarios_equipa_${adminCalendarYear}.csv`;
    link.click();
}

function getTeamVacationsSummary() {
    if (!isUserAdmin()) return;
    
    const users = getUsers();
    const container = document.getElementById('teamVacationsSummary');
    if (!container) return;
    
    let summaryHtml = '';
    
    users.forEach(user => {
        let vacationDays = 0;
        let absenceDays = 0;
        let workedDays = 0;
        
        for (let month = 0; month < 12; month++) {
            const lastDay = new Date(adminCalendarYear, month + 1, 0).getDate();
            for (let day = 1; day <= lastDay; day++) {
                const date = new Date(adminCalendarYear, month, day);
                const dateStr = formatDateKey(date);
                const dayInfo = getTeamDayInfo(dateStr, user.username);
                
                switch(dayInfo.type) {
                    case 'vacation': vacationDays++; break;
                    case 'absence': 
                    case 'auto-absence': absenceDays++; break;
                    case 'worked': workedDays++; break;
                }
            }
        }
        
        summaryHtml += `
            <div class="team-vacation-card">
                <div class="team-vacation-name">${user.firstName} ${user.lastName}</div>
                <div class="team-vacation-stats">
                    <span class="vacation-stat worked">💼 ${workedDays}</span>
                    <span class="vacation-stat vacation">🏖️ ${vacationDays}</span>
                    <span class="vacation-stat absence">❌ ${absenceDays}</span>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = summaryHtml || '<p style="text-align: center; color: #95a5a6;">Sem dados disponíveis</p>';
}

function updateProjectHoursView() {
    if (!isUserAdmin()) return;
    
    populateAdminProjectFilters();
    
    const statusFilter = document.getElementById('projectHoursStatusFilter')?.value || 'all';
    const obraFilter = document.getElementById('projectHoursObraSelect')?.value || 'all';
    const deptFilter = document.getElementById('projectHoursDeptFilter')?.value || 'all';
    const subcategoryFilter = document.getElementById('projectHoursSubcategoryFilter')?.value || 'all';
    const userFilter = document.getElementById('projectHoursUserFilter')?.value || 'all';
    const searchTerm = document.getElementById('projectHoursSearch')?.value?.toLowerCase() || '';
    
    const allProjects = getAllUsersProjects();
    const allHistory = getAllUsersHistory();
    
    let filteredHistory = allHistory.filter(session => {
        if (session.workType !== 'project' || !session.workCode) return false;
        
        if (deptFilter !== 'all' && session.projectType !== deptFilter) return false;
        if (subcategoryFilter !== 'all' && session.subcategory !== subcategoryFilter) return false;
        if (userFilter !== 'all' && session.userName !== userFilter) return false;
        
        return true;
    });

    const projectHours = {};
    
    filteredHistory.forEach(session => {
        if (!projectHours[session.workCode]) {
            projectHours[session.workCode] = {
                workCode: session.workCode,
                workName: session.workName || '',
                totalSeconds: 0,
                users: {},
                departments: {},
                subcategories: {},
                sessions: []
            };
        }
        
        projectHours[session.workCode].totalSeconds += session.duration;
        projectHours[session.workCode].sessions.push(session);
        
        if (session.userName) {
            if (!projectHours[session.workCode].users[session.userName]) {
                projectHours[session.workCode].users[session.userName] = 0;
            }
            projectHours[session.workCode].users[session.userName] += session.duration;
        }
        
        if (session.projectType) {
            if (!projectHours[session.workCode].departments[session.projectType]) {
                projectHours[session.workCode].departments[session.projectType] = 0;
            }
            projectHours[session.workCode].departments[session.projectType] += session.duration;
        }
        
        if (session.subcategory) {
            if (!projectHours[session.workCode].subcategories[session.subcategory]) {
                projectHours[session.workCode].subcategories[session.subcategory] = 0;
            }
            projectHours[session.workCode].subcategories[session.subcategory] += session.duration;
        }
    });
    
    allProjects.forEach(project => {
        if (projectHours[project.workCode]) {
            projectHours[project.workCode].status = project.status || 'open';
            projectHours[project.workCode].workName = project.name || projectHours[project.workCode].workName;
        }
    });
    
    let projectsArray = Object.values(projectHours);
    
    if (statusFilter !== 'all') {
        projectsArray = projectsArray.filter(p => p.status === statusFilter);
    }
    
    if (obraFilter !== 'all') {
        projectsArray = projectsArray.filter(p => p.workCode === obraFilter);
    }
    
    if (searchTerm) {
        projectsArray = projectsArray.filter(p => 
            p.workCode.toLowerCase().includes(searchTerm) || 
            p.workName.toLowerCase().includes(searchTerm)
        );
    }
    
    projectsArray.sort((a, b) => b.totalSeconds - a.totalSeconds);
    
    const totalHours = projectsArray.reduce((sum, p) => sum + p.totalSeconds, 0);
    const totalSessions = projectsArray.reduce((sum, p) => sum + p.sessions.length, 0);
    const uniqueUsers = new Set();
    projectsArray.forEach(p => {
        Object.keys(p.users).forEach(u => uniqueUsers.add(u));
    });
    
    document.getElementById('totalProjectsCount').textContent = projectsArray.length;
    document.getElementById('totalProjectsHours').textContent = formatHoursMinutes(totalHours);
    document.getElementById('totalProjectsSessions').textContent = totalSessions;
    document.getElementById('totalProjectsUsers').textContent = uniqueUsers.size;
    
    renderAdminProjectHoursList(projectsArray);
}

function populateAdminProjectFilters() {
    const obraSelect = document.getElementById('projectHoursObraSelect');
    const statusFilter = document.getElementById('projectHoursStatusFilter')?.value || 'all';
    
    if (obraSelect && obraSelect.options.length <= 1) {
        const allProjects = getAllUsersProjects();
        let filteredProjects = allProjects;
        
        if (statusFilter === 'open') {
            filteredProjects = allProjects.filter(p => p.status === 'open');
        } else if (statusFilter === 'closed') {
            filteredProjects = allProjects.filter(p => p.status === 'closed');
        }
        
        filteredProjects.sort((a, b) => a.workCode.localeCompare(b.workCode));
        
        filteredProjects.forEach(project => {
            const statusIcon = project.status === 'open' ? '🟢' : '🔴';
            obraSelect.innerHTML += `<option value="${project.workCode}">${statusIcon} ${project.workCode} - ${project.name || 'Sem nome'}</option>`;
        });
    }
    
    const userSelect = document.getElementById('projectHoursUserFilter');
    if (userSelect && userSelect.options.length <= 1) {
        const users = getUsers();
        users.sort((a, b) => a.firstName.localeCompare(b.firstName));
        users.forEach(user => {
            userSelect.innerHTML += `<option value="${user.firstName} ${user.lastName}">${user.firstName} ${user.lastName}</option>`;
        });
    }
}

function updateAdminProjectSelect() {
    const obraSelect = document.getElementById('projectHoursObraSelect');
    const statusFilter = document.getElementById('projectHoursStatusFilter')?.value || 'all';
    
    if (!obraSelect) return;
    
    obraSelect.innerHTML = '<option value="all">Todas as Obras</option>';
    
    const allProjects = getAllUsersProjects();
    let filteredProjects = allProjects;
    
    if (statusFilter === 'open') {
        filteredProjects = allProjects.filter(p => p.status === 'open');
    } else if (statusFilter === 'closed') {
        filteredProjects = allProjects.filter(p => p.status === 'closed');
    }
    
    filteredProjects.sort((a, b) => a.workCode.localeCompare(b.workCode));
    
    filteredProjects.forEach(project => {
        const statusIcon = project.status === 'open' ? '🟢' : '🔴';
        obraSelect.innerHTML += `<option value="${project.workCode}">${statusIcon} ${project.workCode} - ${project.name || 'Sem nome'}</option>`;
    });
}

function updateAdminSubcategories() {
    const department = document.getElementById('projectHoursDeptFilter')?.value || 'all';
    const subcategorySelect = document.getElementById('projectHoursSubcategoryFilter');
    const subcategoryGroup = document.getElementById('adminSubcategoryGroup');
    
    if (!subcategorySelect) return;
    
    subcategorySelect.innerHTML = '<option value="all">Todas</option>';
    
    const subcategories = {
        'projeto': ['Horas Design', 'Documentação para Aprovação', 'Documentação para Fabrico', 'Documentação Técnica', 'Horas Aditamento', 'Horas de Não Conformidade'],
        'eletrico': ['Horas Design', 'Documentação para Aprovação', 'Documentação para Fabrico', 'Documentação Técnica', 'Horas Aditamento', 'Horas de Não Conformidade'],
        'desenvolvimento': [],
        'orcamentacao': ['Orçamento', 'Ordem de produção']
    };
    
    if (department !== 'all' && subcategories[department] && subcategories[department].length > 0) {
        if (subcategoryGroup) subcategoryGroup.style.display = 'flex';
        subcategories[department].forEach(sub => {
            subcategorySelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    } else {
        if (subcategoryGroup) subcategoryGroup.style.display = department === 'all' ? 'flex' : 'none';
        
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

function renderAdminProjectHoursList(projectsArray) {
    const container = document.getElementById('projectHoursTable');
    if (!container) return;
    
    if (projectsArray.length === 0) {
        container.innerHTML = `
            <div class="horas-obra-empty">
                <div class="horas-obra-empty-icon">📋</div>
                <p>Sem registos para os filtros selecionados</p>
                <p style="font-size: 12px; margin-top: 10px;">Experimente alterar os filtros ou selecionar uma obra diferente</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    projectsArray.forEach(data => {
        const statusClass = data.status === 'open' ? 'open' : 'closed';
        const statusText = data.status === 'open' ? 'Aberta' : 'Concluída';
        const safeId = 'admin_' + data.workCode.replace(/[^a-zA-Z0-9]/g, '_');
        
        html += `
            <div class="horas-obra-card">
                <div class="horas-obra-card-header" onclick="toggleAdminProjectDetails('${safeId}')">
                    <div class="horas-obra-card-info">
                        <div class="horas-obra-card-code">${data.workCode}</div>
                        <div class="horas-obra-card-name">${data.workName || 'Sem nome'}</div>
                    </div>
                    <div class="horas-obra-card-stats">
                        <span class="horas-obra-status-badge ${statusClass}">${statusText}</span>
                        <span class="horas-obra-card-sessions">${data.sessions.length} sessões</span>
                        <span class="horas-obra-card-hours">${formatHoursMinutes(data.totalSeconds)}</span>
                    </div>
                </div>
                <div class="horas-obra-card-details hidden" id="${safeId}">
                    ${renderAdminProjectBreakdown(data)}
                    ${renderAdminProjectSessions(data.sessions)}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderAdminProjectBreakdown(data) {
    let html = '<div class="horas-obra-breakdown">';
    
    if (Object.keys(data.users).length > 0) {
        html += '<h5>👥 Por Utilizador</h5><div class="horas-obra-breakdown-grid">';
        Object.entries(data.users).sort((a, b) => b[1] - a[1]).forEach(([userName, seconds]) => {
            html += `
                <div class="horas-obra-breakdown-item department">
                    <div class="horas-obra-breakdown-label">${userName}</div>
                    <div class="horas-obra-breakdown-value">${formatHoursMinutes(seconds)}</div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (Object.keys(data.departments).length > 0) {
        html += '<h5 style="margin-top: 15px;">🏢 Por Departamento</h5><div class="horas-obra-breakdown-grid">';
        Object.entries(data.departments).sort((a, b) => b[1] - a[1]).forEach(([dept, seconds]) => {
            html += `
                <div class="horas-obra-breakdown-item department">
                    <div class="horas-obra-breakdown-label">${getDepartmentName(dept)}</div>
                    <div class="horas-obra-breakdown-value">${formatHoursMinutes(seconds)}</div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (Object.keys(data.subcategories).length > 0) {
        html += '<h5 style="margin-top: 15px;">📂 Por Subcategoria</h5><div class="horas-obra-breakdown-grid">';
        Object.entries(data.subcategories).sort((a, b) => b[1] - a[1]).forEach(([sub, seconds]) => {
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

function renderAdminProjectSessions(sessions) {
    if (sessions.length === 0) return '';
    
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    const displaySessions = sortedSessions.slice(0, 15);
    
    let html = '<div class="horas-obra-sessions-list">';
    html += `<h5>📝 Últimas Sessões ${sessions.length > 15 ? `(${displaySessions.length} de ${sessions.length})` : ''}</h5>`;
    
    displaySessions.forEach(session => {
        const date = new Date(session.startTime);
        const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        const dept = getDepartmentName(session.projectType) || 'N/A';
        const sub = session.subcategory || '';
        const userName = session.userName || 'Desconhecido';
        
        html += `
            <div class="horas-obra-session-item">
                <div class="horas-obra-session-info">
                    <div class="horas-obra-session-date">${dateStr} às ${timeStr} - ${userName}</div>
                    <div class="horas-obra-session-meta">${dept}${sub ? ' • ' + sub : ''}</div>
                </div>
                <div class="horas-obra-session-duration">${formatHoursMinutes(session.duration)}</div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function toggleAdminProjectDetails(id) {
    const details = document.getElementById(id);
    if (details) {
        details.classList.toggle('hidden');
    }
}

function exportProjectHoursCSV() {
    if (!isUserAdmin()) return;
    
    const statusFilter = document.getElementById('projectHoursStatusFilter')?.value || 'all';
    const obraFilter = document.getElementById('projectHoursObraSelect')?.value || 'all';
    const deptFilter = document.getElementById('projectHoursDeptFilter')?.value || 'all';
    const subcategoryFilter = document.getElementById('projectHoursSubcategoryFilter')?.value || 'all';
    const userFilter = document.getElementById('projectHoursUserFilter')?.value || 'all';
    const searchTerm = document.getElementById('projectHoursSearch')?.value?.toLowerCase() || '';
    
    const allProjects = getAllUsersProjects();
    const allHistory = getAllUsersHistory();
    
    let filteredHistory = allHistory.filter(session => {
        if (session.workType !== 'project' || !session.workCode) return false;
        if (deptFilter !== 'all' && session.projectType !== deptFilter) return false;
        if (subcategoryFilter !== 'all' && session.subcategory !== subcategoryFilter) return false;
        if (userFilter !== 'all' && session.userName !== userFilter) return false;
        return true;
    });
    
    if (statusFilter !== 'all' || obraFilter !== 'all') {
        const validCodes = new Set();
        allProjects.forEach(p => {
            if (statusFilter !== 'all' && p.status !== statusFilter) return;
            if (obraFilter !== 'all' && p.workCode !== obraFilter) return;
            validCodes.add(p.workCode);
        });
        filteredHistory = filteredHistory.filter(s => validCodes.has(s.workCode));
    }
    
    if (searchTerm) {
        filteredHistory = filteredHistory.filter(s => {
            const project = allProjects.find(p => p.workCode === s.workCode);
            return s.workCode.toLowerCase().includes(searchTerm) || 
                   (project?.name || '').toLowerCase().includes(searchTerm);
        });
    }
    
    let csv = 'Código Obra,Nome Obra,Estado,Utilizador,Data,Hora Início,Hora Fim,Departamento,Subcategoria,Duração (h),Comentário\n';
    
    filteredHistory.sort((a, b) => new Date(a.startTime) - new Date(b.startTime)).forEach(session => {
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
        const userName = session.userName || '';
        
        csv += `"${session.workCode}","${projectName}","${status}","${userName}","${dateStr}","${startTimeStr}","${endTimeStr}","${dept}","${sub}","${durationHours}","${comment}"\n`;
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `horas_por_obra_equipa_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

function exportReopensCSV() {
    if (!isUserAdmin()) return;
    
    const allProjects = getAllUsersProjects();
    const allHistory = getAllUsersHistory();
    
    let csv = 'Código Obra,Nome Obra,Estado,Tipo Reabertura,Data Reabertura,Comentário,Horas Após Reabertura,Utilizador,Horas Utilizador\n';
    
    allProjects.forEach(project => {
        if (!project.reopenHistory || project.reopenHistory.length === 0) return;
        
        const status = project.status === 'closed' ? 'Fechada' : 'Aberta';
        
        const clientReopens = project.reopenHistory.filter(r => r.reason === 'client_change');
        const errorReopens = project.reopenHistory.filter(r => r.reason === 'our_error');
        
        if (clientReopens.length > 0) {
            const firstClientDate = new Date(Math.min(...clientReopens.map(r => new Date(r.date))));
            const clientUsers = {};
            let clientTotal = 0;
            
            allHistory.forEach(session => {
                if (session.workType !== 'project' || session.workCode !== project.workCode) return;
                const sessionDate = new Date(session.startTime);
                if (sessionDate >= firstClientDate) {
                    clientTotal += session.duration;
                    const userName = session.userName || 'Desconhecido';
                    if (!clientUsers[userName]) clientUsers[userName] = 0;
                    clientUsers[userName] += session.duration;
                }
            });
            
            clientReopens.forEach(reopen => {
                const date = new Date(reopen.date);
                const dateStr = date.getDate().toString().padStart(2, '0') + '/' + (date.getMonth() + 1).toString().padStart(2, '0') + '/' + date.getFullYear();
                const comment = (reopen.comment || '').replace(/"/g, '""');
                const totalHours = (clientTotal / 3600).toFixed(2);
                
                if (Object.keys(clientUsers).length > 0) {
                    Object.entries(clientUsers).forEach(([userName, seconds]) => {
                        const userHours = (seconds / 3600).toFixed(2);
                        csv += '"' + project.workCode + '","' + (project.name || '') + '","' + status + '","Alteração Cliente","' + dateStr + '","' + comment + '","' + totalHours + '","' + userName + '","' + userHours + '"\n';
                    });
                } else {
                    csv += '"' + project.workCode + '","' + (project.name || '') + '","' + status + '","Alteração Cliente","' + dateStr + '","' + comment + '","' + totalHours + '","",""\n';
                }
            });
        }
        
        if (errorReopens.length > 0) {
            const firstErrorDate = new Date(Math.min(...errorReopens.map(r => new Date(r.date))));
            const errorUsers = {};
            let errorTotal = 0;
            
            allHistory.forEach(session => {
                if (session.workType !== 'project' || session.workCode !== project.workCode) return;
                const sessionDate = new Date(session.startTime);
                if (sessionDate >= firstErrorDate) {
                    errorTotal += session.duration;
                    const userName = session.userName || 'Desconhecido';
                    if (!errorUsers[userName]) errorUsers[userName] = 0;
                    errorUsers[userName] += session.duration;
                }
            });
            
            errorReopens.forEach(reopen => {
                const date = new Date(reopen.date);
                const dateStr = date.getDate().toString().padStart(2, '0') + '/' + (date.getMonth() + 1).toString().padStart(2, '0') + '/' + date.getFullYear();
                const comment = (reopen.comment || '').replace(/"/g, '""');
                const totalHours = (errorTotal / 3600).toFixed(2);
                
                if (Object.keys(errorUsers).length > 0) {
                    Object.entries(errorUsers).forEach(([userName, seconds]) => {
                        const userHours = (seconds / 3600).toFixed(2);
                        csv += '"' + project.workCode + '","' + (project.name || '') + '","' + status + '","Erro Interno","' + dateStr + '","' + comment + '","' + totalHours + '","' + userName + '","' + userHours + '"\n';
                    });
                } else {
                    csv += '"' + project.workCode + '","' + (project.name || '') + '","' + status + '","Erro Interno","' + dateStr + '","' + comment + '","' + totalHours + '","",""\n';
                }
            });
        }
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'reaberturas_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
}

function updateAdminReopensView() {
    if (!isUserAdmin()) return;
    
    const allProjects = getAllUsersProjects();
    const allHistory = getAllUsersHistory();
    
    const userHours = {};
    const clientProjects = [];
    const errorProjects = [];
    let totalClientHours = 0;
    let totalErrorHours = 0;
    
    allProjects.forEach(project => {
        if (!project.reopenHistory || project.reopenHistory.length === 0) return;
        
        const clientReopens = project.reopenHistory.filter(r => r.reason === 'client_change');
        const errorReopens = project.reopenHistory.filter(r => r.reason === 'our_error');
        
        const firstClientDate = clientReopens.length > 0 ? new Date(Math.min(...clientReopens.map(r => new Date(r.date)))) : null;
        const firstErrorDate = errorReopens.length > 0 ? new Date(Math.min(...errorReopens.map(r => new Date(r.date)))) : null;
        
        const projectSessions = allHistory.filter(s => s.workType === 'project' && s.workCode === project.workCode);
        
        let projectClientHours = 0;
        let projectErrorHours = 0;
        const projectClientUsers = {};
        const projectErrorUsers = {};
        
        projectSessions.forEach(session => {
            const sessionDate = new Date(session.startTime);
            const userName = session.userName || 'Desconhecido';
            
            if (firstClientDate && sessionDate >= firstClientDate) {
                projectClientHours += session.duration;
                if (!projectClientUsers[userName]) projectClientUsers[userName] = 0;
                projectClientUsers[userName] += session.duration;
                
                if (!userHours[userName]) userHours[userName] = { client: 0, error: 0 };
                userHours[userName].client += session.duration;
            }
            
            if (firstErrorDate && sessionDate >= firstErrorDate) {
                projectErrorHours += session.duration;
                if (!projectErrorUsers[userName]) projectErrorUsers[userName] = 0;
                projectErrorUsers[userName] += session.duration;
                
                if (!userHours[userName]) userHours[userName] = { client: 0, error: 0 };
                userHours[userName].error += session.duration;
            }
        });
        
        if (clientReopens.length > 0) {
            totalClientHours += projectClientHours;
            clientProjects.push({
                workCode: project.workCode,
                name: project.name,
                status: project.status,
                hours: projectClientHours,
                users: projectClientUsers,
                reopenCount: clientReopens.length,
                reopenHistory: clientReopens
            });
        }
        
        if (errorReopens.length > 0) {
            totalErrorHours += projectErrorHours;
            errorProjects.push({
                workCode: project.workCode,
                name: project.name,
                status: project.status,
                hours: projectErrorHours,
                users: projectErrorUsers,
                reopenCount: errorReopens.length,
                reopenHistory: errorReopens
            });
        }
    });
    
    const totalProjects = new Set([...clientProjects.map(p => p.workCode), ...errorProjects.map(p => p.workCode)]).size;
    const totalHours = totalClientHours + totalErrorHours;
    
    document.getElementById('adminReopenTotalCount').textContent = totalProjects;
    document.getElementById('adminReopenTotalHours').textContent = formatHoursMinutes(totalHours);
    document.getElementById('adminReopenClientCount').textContent = clientProjects.length;
    document.getElementById('adminReopenClientHours').textContent = formatHoursMinutes(totalClientHours);
    document.getElementById('adminReopenErrorCount').textContent = errorProjects.length;
    document.getElementById('adminReopenErrorHours').textContent = formatHoursMinutes(totalErrorHours);
    
    renderAdminReopensUsersTable(userHours);
    renderAdminReopensProjectsList(clientProjects, errorProjects);
}

function renderAdminReopensUsersTable(userHours) {
    const container = document.getElementById('adminReopenUsersTable');
    if (!container) return;
    
    const usersArray = Object.entries(userHours).map(([name, hours]) => ({
        name,
        client: hours.client,
        error: hours.error,
        total: hours.client + hours.error
    })).sort((a, b) => b.total - a.total);
    
    if (usersArray.length === 0) {
        container.innerHTML = '<p style="color: #95a5a6; text-align: center; padding: 20px;">Sem dados de reaberturas</p>';
        return;
    }
    
    let html = '<div class="admin-reopen-table"><div class="admin-reopen-row header"><div>Utilizador</div><div>👤 Alt. Cliente</div><div>⚠️ Erro Interno</div><div>📊 Total</div></div>';
    
    usersArray.forEach(user => {
        html += '<div class="admin-reopen-row">';
        html += '<div class="user-name">' + user.name + '</div>';
        html += '<div class="hours client">' + formatHoursMinutes(user.client) + '</div>';
        html += '<div class="hours error">' + formatHoursMinutes(user.error) + '</div>';
        html += '<div class="hours total">' + formatHoursMinutes(user.total) + '</div>';
        html += '</div>';
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function renderAdminReopensProjectsList(clientProjects, errorProjects) {
    const container = document.getElementById('adminReopenProjectsList');
    if (!container) return;
    
    const allProjects = [...clientProjects.map(p => ({...p, type: 'client'})), ...errorProjects.map(p => ({...p, type: 'error'}))];
    allProjects.sort((a, b) => b.hours - a.hours);
    
    if (allProjects.length === 0) {
        container.innerHTML = '<p style="color: #95a5a6; text-align: center; padding: 20px;">Sem obras reabertas</p>';
        return;
    }
    
    let html = '';
    allProjects.forEach(project => {
        const typeIcon = project.type === 'client' ? '👤' : '⚠️';
        const typeLabel = project.type === 'client' ? 'Alt. Cliente' : 'Erro Interno';
        const typeClass = project.type === 'client' ? 'client' : 'error';
        const statusBadge = project.status === 'closed' ? '<span class="status-badge closed">Fechada</span>' : '<span class="status-badge open">Aberta</span>';
        const safeId = 'admin_' + project.workCode.replace(/[^a-zA-Z0-9]/g, '_') + '_' + project.type;
        
        html += '<div class="admin-reopen-project" onclick="toggleAdminReopenDetails(\'' + safeId + '\')">';
        html += '<div class="admin-reopen-project-header">';
        html += '<div class="project-info"><span class="type-badge ' + typeClass + '">' + typeIcon + ' ' + typeLabel + '</span>';
        html += '<span class="project-code">' + project.workCode + '</span><span class="project-name">' + (project.name || '') + '</span></div>';
        html += '<div class="project-stats">' + statusBadge + '<span class="project-hours">' + formatHoursMinutes(project.hours) + '</span></div>';
        html += '</div>';
        html += '<div class="admin-reopen-project-details hidden" id="' + safeId + '">';
        
        html += '<div class="details-section"><h5>👥 Horas por Utilizador</h5><div class="users-list">';
        Object.entries(project.users).sort((a, b) => b[1] - a[1]).forEach(([name, seconds]) => {
            html += '<div class="user-item"><span>' + name + '</span><span>' + formatHoursMinutes(seconds) + '</span></div>';
        });
        if (Object.keys(project.users).length === 0) {
            html += '<p class="no-data">Sem horas registadas</p>';
        }
        html += '</div></div>';
        
        html += '<div class="details-section"><h5>📅 Histórico</h5><div class="history-list">';
        project.reopenHistory.forEach(r => {
            const date = new Date(r.date);
            const dateStr = date.getDate().toString().padStart(2, '0') + '/' + (date.getMonth() + 1).toString().padStart(2, '0') + '/' + date.getFullYear();
            html += '<div class="history-item"><span class="date">' + dateStr + '</span><span class="comment">' + (r.comment || 'Sem observação') + '</span></div>';
        });
        html += '</div></div>';
        
        html += '</div></div>';
    });
    
    container.innerHTML = html;
}

function toggleAdminReopenDetails(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
}

function exportAdminReopensCSV() {
    if (!isUserAdmin()) return;
    
    const allProjects = getAllUsersProjects();
    const allHistory = getAllUsersHistory();
    
    let csv = 'Tipo,Código Obra,Nome,Estado,Utilizador,Horas Após Reabertura,Data Reabertura,Comentário\n';
    
    allProjects.forEach(project => {
        if (!project.reopenHistory || project.reopenHistory.length === 0) return;
        
        const clientReopens = project.reopenHistory.filter(r => r.reason === 'client_change');
        const errorReopens = project.reopenHistory.filter(r => r.reason === 'our_error');
        const status = project.status === 'closed' ? 'Fechada' : 'Aberta';
        
        [{ reopens: clientReopens, type: 'Alteração Cliente' }, { reopens: errorReopens, type: 'Erro Interno' }].forEach(({ reopens, type }) => {
            if (reopens.length === 0) return;
            
            const firstDate = new Date(Math.min(...reopens.map(r => new Date(r.date))));
            const userHours = {};
            
            allHistory.filter(s => s.workType === 'project' && s.workCode === project.workCode).forEach(session => {
                if (new Date(session.startTime) >= firstDate) {
                    const userName = session.userName || 'Desconhecido';
                    if (!userHours[userName]) userHours[userName] = 0;
                    userHours[userName] += session.duration;
                }
            });
            
            reopens.forEach(r => {
                const date = new Date(r.date);
                const dateStr = date.getDate().toString().padStart(2, '0') + '/' + (date.getMonth() + 1).toString().padStart(2, '0') + '/' + date.getFullYear();
                const comment = (r.comment || '').replace(/"/g, '""');
                
                if (Object.keys(userHours).length > 0) {
                    Object.entries(userHours).forEach(([userName, seconds]) => {
                        csv += '"' + type + '","' + project.workCode + '","' + (project.name || '') + '","' + status + '","' + userName + '","' + (seconds/3600).toFixed(2) + '","' + dateStr + '","' + comment + '"\n';
                    });
                } else {
                    csv += '"' + type + '","' + project.workCode + '","' + (project.name || '') + '","' + status + '","","0","' + dateStr + '","' + comment + '"\n';
                }
            });
        });
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'reaberturas_equipa_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
}

window.addEventListener('load', () => {
    initializeDefaultAdmin();
});