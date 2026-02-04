const HOLIDAYS = {
    '2025-01-01': 'Ano Novo',
    '2025-04-18': 'Sexta-feira Santa',
    '2025-04-20': 'Domingo de Páscoa',
    '2025-04-25': 'Dia da Liberdade',
    '2025-05-01': 'Dia do Trabalhador',
    '2025-06-10': 'Dia de Portugal',
    '2025-06-19': 'Corpo de Deus',
    '2025-08-15': 'Assunção de Nossa Senhora',
    '2025-10-05': 'Implantação da República',
    '2025-11-01': 'Dia de Todos os Santos',
    '2025-12-01': 'Restauração da Independência',
    '2025-12-08': 'Imaculada Conceição',
    '2025-12-25': 'Natal',
    '2026-01-01': 'Ano Novo',
    '2026-04-03': 'Sexta-feira Santa',
    '2026-04-05': 'Domingo de Páscoa',
    '2026-04-25': 'Dia da Liberdade',
    '2026-05-01': 'Dia do Trabalhador',
    '2026-06-04': 'Corpo de Deus',
    '2026-06-10': 'Dia de Portugal',
    '2026-08-15': 'Assunção de Nossa Senhora',
    '2026-10-05': 'Implantação da República',
    '2026-11-01': 'Dia de Todos os Santos',
    '2026-12-01': 'Restauração da Independência',
    '2026-12-08': 'Imaculada Conceição',
    '2026-12-25': 'Natal',
    '2027-01-01': 'Ano Novo',
    '2027-03-26': 'Sexta-feira Santa',
    '2027-03-28': 'Domingo de Páscoa',
    '2027-04-25': 'Dia da Liberdade',
    '2027-05-01': 'Dia do Trabalhador',
    '2027-05-27': 'Corpo de Deus',
    '2027-06-10': 'Dia de Portugal',
    '2027-08-15': 'Assunção de Nossa Senhora',
    '2027-10-05': 'Implantação da República',
    '2027-11-01': 'Dia de Todos os Santos',
    '2027-12-01': 'Restauração da Independência',
    '2027-12-08': 'Imaculada Conceição',
    '2027-12-25': 'Natal'
};

let currentYear = 2026;

// Cache local para calendário (carregado da API)
let _calendarCache = {};
let _historyCache = [];

async function loadCalendarFromAPI() {
    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            _calendarCache = {};
            return;
        }
        if (typeof apiRequest === 'function') {
            _calendarCache = await apiRequest(`/calendar/${currentYear}`);
        }
    } catch (error) {
        console.error('Erro ao carregar calendário:', error);
        _calendarCache = {};
    }
}

async function loadHistoryForCalendar() {
    try {
        const user = localStorage.getItem('currentUser');
        if (!user) {
            _historyCache = [];
            return;
        }
        // Usar cache do api-layer se disponível
        const history = getWorkHistory();
        if (Array.isArray(history)) {
            _historyCache = history;
        }
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        _historyCache = [];
    }
}

function getCalendarData() {
    return _calendarCache || {};
}

function saveCalendarData(data) {
    _calendarCache = data;
    // Guardar cada entrada via API
    Object.entries(data).forEach(([date, entry]) => {
        if (typeof apiRequest === 'function') {
            apiRequest('/calendar', {
                method: 'POST',
                body: JSON.stringify({ date, type: entry.type, note: entry.note })
            }).catch(err => console.error('Erro ao guardar calendário:', err));
        }
    });
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isWeekend(date) {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0; 
}

function isHoliday(dateStr) {
    return HOLIDAYS[dateStr] || null;
}

function hasWorkedOnDay(dateStr) {
    // Verificar se há utilizador logado
    const user = localStorage.getItem('currentUser');
    if (!user) return false;
    
    // Usar cache local ou tentar obter do getWorkHistory
    let history = _historyCache;
    if (!history || history.length === 0) {
        try {
            history = getWorkHistory();
            if (Array.isArray(history)) {
                _historyCache = history;
            } else {
                return false;
            }
        } catch (e) {
            return false;
        }
    }
    if (!Array.isArray(history)) return false;
    return history.some(session => {
        const sessionDate = new Date(session.startTime);
        return formatDateKey(sessionDate) === dateStr;
    });
}

function getDayInfo(dateStr) {
    const calendarData = getCalendarData();
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
    
    if (hasWorkedOnDay(dateStr)) {
        return { type: 'worked', color: 'worked', icon: '💼', note: '' };
    }
    
    if (checkDate <= yesterday) {
        return { type: 'auto-absence', color: 'auto-absence', icon: '⚠️', note: 'Falta (sem registo)' };
    }
    
    return { type: 'empty', color: 'empty', icon: '', note: '' };
}

function renderAnnualCalendar(year) {
    currentYear = year;
    const container = document.getElementById('annualCalendarGrid');
    if (!container) return;
    
    container.innerHTML = '';
    
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
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
            const dayInfo = getDayInfo(dateStr);
            
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
            
            dayEl.onclick = () => openDayModal(dateStr, dayInfo);
            
            daysGrid.appendChild(dayEl);
        }
        
        monthCard.appendChild(daysGrid);
        container.appendChild(monthCard);
    });
    
    updateAnnualStats();
}

function openDayModal(dateStr, dayInfo) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayName = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][date.getDay()];
    const dayNum = date.getDate();
    const monthName = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][date.getMonth()];
    
    document.getElementById('modalDayDate').textContent = `${dayName}, ${dayNum} de ${monthName} de ${currentYear}`;
    
    const contentDiv = document.getElementById('modalDayContent');
    let statusHtml = '';
    
    if (dayInfo.type === 'vacation') {
        statusHtml = `
            <div class="day-status vacation-status">
                <span class="status-icon">🏖️</span>
                <span class="status-text">Férias</span>
            </div>
            ${dayInfo.note ? `<div class="day-note">📝 ${dayInfo.note}</div>` : ''}
            <button class="btn btn-danger btn-small" onclick="clearDayMarking('${dateStr}')">🗑️ Limpar</button>
        `;
    } else if (dayInfo.type === 'absence') {
        statusHtml = `
            <div class="day-status absence-status">
                <span class="status-icon">❌</span>
                <span class="status-text">Falta</span>
            </div>
            ${dayInfo.note ? `<div class="day-note">📝 ${dayInfo.note}</div>` : ''}
            <button class="btn btn-danger btn-small" onclick="clearDayMarking('${dateStr}')">🗑️ Limpar</button>
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
                <span class="status-text">Fim de Semana</span>
            </div>
        `;
    } else if (dayInfo.type === 'worked') {
        statusHtml = `
            <div class="day-status worked-status">
                <span class="status-icon">💼</span>
                <span class="status-text">Dia Trabalhado</span>
            </div>
            <p style="font-size: 12px; color: #6c757d; margin: 15px 0;">Este dia foi registado automaticamente pelo sistema com base no seu histórico de trabalho.</p>
            <div class="day-actions">
                <button class="btn btn-warning btn-small" onclick="closeDayModal(); markAsVacation('${dateStr}')">🏖️ Marcar Férias</button>
                <button class="btn btn-danger btn-small" onclick="closeDayModal(); markAsAbsence('${dateStr}')">❌ Marcar Falta</button>
            </div>
        `;
    } else if (dayInfo.type === 'auto-absence') {
        statusHtml = `
            <div class="day-status auto-absence-status">
                <span class="status-icon">⚠️</span>
                <span class="status-text">Falta Automática</span>
            </div>
            <p style="font-size: 12px; color: #e67e22; margin: 15px 0; font-weight: 500;">⚠️ Este dia foi marcado automaticamente como falta porque não há registo de trabalho.</p>
            <p style="font-size: 11px; color: #6c757d; margin: 10px 0;">Se trabalhou neste dia mas esqueceu de registar, ou se esteve de férias/ausente, pode corrigir abaixo:</p>
            <div class="day-actions">
                <button class="btn btn-success btn-small" onclick="closeDayModal(); markAsWorked('${dateStr}')">💼 Marcar como Trabalhado</button>
                <button class="btn btn-warning btn-small" onclick="closeDayModal(); markAsVacation('${dateStr}')">🏖️ Marcar Férias</button>
                <button class="btn btn-secondary btn-small" onclick="closeDayModal(); markAsAbsence('${dateStr}')">❌ Confirmar Falta</button>
            </div>
        `;
    } else {
        statusHtml = `
            <div class="day-status empty-status">
                <span class="status-icon">📅</span>
                <span class="status-text">Sem Registo</span>
            </div>
            <p style="font-size: 12px; color: #6c757d; margin: 15px 0;">Este dia não tem informação registada.</p>
            <div class="day-actions">
                <button class="btn btn-warning btn-small" onclick="closeDayModal(); markAsVacation('${dateStr}')">🏖️ Marcar Férias</button>
                <button class="btn btn-danger btn-small" onclick="closeDayModal(); markAsAbsence('${dateStr}')">❌ Marcar Falta</button>
            </div>
        `;
    }
    
    contentDiv.innerHTML = statusHtml;
    document.getElementById('dayModal').classList.add('show');
}

function closeDayModal() {
    document.getElementById('dayModal').classList.remove('show');
}

function clearDayMarking(dateStr) {
    showConfirm('Limpar Marcação', 'Tem certeza que deseja remover esta marcação?', function() {
        const calendarData = getCalendarData();
        delete calendarData[dateStr];
        saveCalendarData(calendarData);
        closeDayModal();
        renderAnnualCalendar(currentYear);
        showAlert('Sucesso', 'Marcação removida com sucesso!');
    });
}

function markAsVacation(dateStr) {
    document.getElementById('singleVacationDate').value = dateStr;
    document.getElementById('singleVacationNote').value = '';
    document.getElementById('singleVacationModal').classList.add('show');
}

function confirmSingleVacation() {
    const dateStr = document.getElementById('singleVacationDate').value;
    const note = document.getElementById('singleVacationNote').value.trim();
    
    const calendarData = getCalendarData();
    calendarData[dateStr] = {
        type: 'vacation',
        note: note,
        markedAt: new Date().toISOString()
    };
    saveCalendarData(calendarData);
    
    closeSingleVacationModal();
    renderAnnualCalendar(currentYear);
    showAlert('Sucesso', 'Férias marcadas com sucesso!');
}

function closeSingleVacationModal() {
    document.getElementById('singleVacationModal').classList.remove('show');
}

function markAsAbsence(dateStr) {
    document.getElementById('singleAbsenceDate').value = dateStr;
    document.getElementById('singleAbsenceNote').value = '';
    document.getElementById('absenceError').classList.add('hidden');
    document.getElementById('singleAbsenceModal').classList.add('show');
}

function confirmSingleAbsence() {
    const dateStr = document.getElementById('singleAbsenceDate').value;
    const note = document.getElementById('singleAbsenceNote').value.trim();
    const errorDiv = document.getElementById('absenceError');
    
    if (!note) {
        errorDiv.textContent = '⚠️ O motivo da falta é obrigatório.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const calendarData = getCalendarData();
    calendarData[dateStr] = {
        type: 'absence',
        note: note,
        markedAt: new Date().toISOString()
    };
    saveCalendarData(calendarData);
    
    closeSingleAbsenceModal();
    renderAnnualCalendar(currentYear);
    showAlert('Sucesso', 'Falta marcada com sucesso!');
}

function closeSingleAbsenceModal() {
    document.getElementById('singleAbsenceModal').classList.remove('show');
}

function markAsWorked(dateStr) {
    showConfirm(
        'Marcar como Trabalhado',
        'Confirma que trabalhou neste dia? Esta marcação irá substituir a falta automática.',
        function() {
            const calendarData = getCalendarData();
            calendarData[dateStr] = {
                type: 'worked',
                note: 'Marcado manualmente',
                markedAt: new Date().toISOString()
            };
            saveCalendarData(calendarData);
            renderAnnualCalendar(currentYear);
            showAlert('Sucesso', 'Dia marcado como trabalhado!');
        }
    );
}

function openVacationPeriodModal() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    document.getElementById('vacationStartDate').value = formatDateKey(tomorrow);
    document.getElementById('vacationEndDate').value = formatDateKey(tomorrow);
    document.getElementById('vacationPeriodNote').value = '';
    updateVacationDaysCount();
    document.getElementById('vacationPeriodModal').classList.add('show');
}

function closeVacationPeriodModal() {
    document.getElementById('vacationPeriodModal').classList.remove('show');
}


function updateVacationDaysCount() {
    const startDateStr = document.getElementById('vacationStartDate').value;
    const endDateStr = document.getElementById('vacationEndDate').value;
    
    if (!startDateStr || !endDateStr) {
        document.getElementById('vacationDaysCount').textContent = '0 dias';
        return;
    }
    
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T00:00:00');
    
    if (endDate < startDate) {
        document.getElementById('vacationDaysCount').textContent = '0 dias';
        return;
    }
    
    let count = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dateStr = formatDateKey(currentDate);
        if (!isWeekend(currentDate) && !isHoliday(dateStr)) {
            count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    if (count === 1) {
        document.getElementById('vacationDaysCount').textContent = '1 dia útil';
    } else {
        document.getElementById('vacationDaysCount').textContent = `${count} dias úteis`;
    }
}

function confirmVacationPeriod() {
    const startDateStr = document.getElementById('vacationStartDate').value;
    const endDateStr = document.getElementById('vacationEndDate').value;
    const note = document.getElementById('vacationPeriodNote').value.trim();
    
    if (!startDateStr || !endDateStr) {
        showAlert('Erro', 'Por favor, preencha as datas de início e fim.');
        return;
    }
    
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T00:00:00');
    
    if (endDate < startDate) {
        showAlert('Erro', 'A data de fim deve ser posterior à data de início.');
        return;
    }
    
    const calendarData = getCalendarData();
    const currentDate = new Date(startDate);
    let markedCount = 0;
    
    while (currentDate <= endDate) {
        const dateStr = formatDateKey(currentDate);
        if (!isWeekend(currentDate) && !isHoliday(dateStr)) {
            calendarData[dateStr] = {
                type: 'vacation',
                note: note,
                markedAt: new Date().toISOString()
            };
            markedCount++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    saveCalendarData(calendarData);
    closeVacationPeriodModal();
    renderAnnualCalendar(currentYear);
    showAlert('Sucesso', `${markedCount} dia${markedCount !== 1 ? 's' : ''} de férias marcado${markedCount !== 1 ? 's' : ''}!`);
}

function updateAnnualStats() {
    let workedDays = 0;
    let vacationDays = 0;
    let absenceDays = 0;
    let holidayDays = 0;
    let weekendDays = 0;
    
    for (let month = 0; month < 12; month++) {
        const lastDay = new Date(currentYear, month + 1, 0).getDate();
        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(currentYear, month, day);
            const dateStr = formatDateKey(date);
            const dayInfo = getDayInfo(dateStr);
            
            switch(dayInfo.type) {
                case 'worked': workedDays++; break;
                case 'vacation': vacationDays++; break;
                case 'absence': absenceDays++; break;
                case 'holiday': holidayDays++; break;
                case 'weekend': weekendDays++; break;
            }
        }
    }
    
    const totalDays = 365 + (currentYear % 4 === 0 ? 1 : 0);
    const remainingDays = totalDays - workedDays - vacationDays - absenceDays - holidayDays - weekendDays;
    
    document.getElementById('statWorkedDays').textContent = workedDays;
    document.getElementById('statVacationDays').textContent = vacationDays;
    document.getElementById('statAbsenceDays').textContent = absenceDays;
    document.getElementById('statHolidayDays').textContent = holidayDays;
    document.getElementById('statWeekendDays').textContent = weekendDays;
    document.getElementById('statRemainingDays').textContent = remainingDays;
}

async function changeYear(delta) {
    const todayYear = new Date().getFullYear();
    const newYear = currentYear + delta;
    
    if (newYear < todayYear) {
        return;
    }
    
    currentYear = newYear;
    const yearDisplay = document.getElementById('currentYearDisplay');
    if (yearDisplay) yearDisplay.textContent = currentYear;
    await loadCalendarFromAPI();
    renderAnnualCalendar(currentYear);
}

async function goToCurrentYear() {
    currentYear = new Date().getFullYear();
    const yearDisplay = document.getElementById('currentYearDisplay');
    if (yearDisplay) yearDisplay.textContent = currentYear;
    await loadCalendarFromAPI();
    renderAnnualCalendar(currentYear);
}

async function initializeAnnualCalendar() {
    currentYear = new Date().getFullYear();
    const yearDisplay = document.getElementById('currentYearDisplay');
    if (yearDisplay) yearDisplay.textContent = currentYear;
    
    // Carregar dados da API antes de renderizar
    await loadCalendarFromAPI();
    await loadHistoryForCalendar();
    
    renderAnnualCalendar(currentYear);
}