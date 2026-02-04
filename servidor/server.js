const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const { initializeDatabase, dbRun, dbGet, dbAll, saveDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_me';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../aplicacao')));

// ==================== MIDDLEWARE DE AUTENTICAÇÃO ====================

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Acesso restrito a administradores' });
    }
    next();
}

// ==================== ROTAS DE AUTENTICAÇÃO ====================

app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;

        const user = dbGet('SELECT * FROM users WHERE username = ?', [username]);

        if (!user) {
            return res.status(401).json({ error: 'Utilizador não encontrado' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Password incorreta' });
        }

        const token = jwt.sign(
            { 
                id: user.id, 
                username: user.username, 
                isAdmin: user.is_admin === 1 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
                defaultDepartment: user.default_department,
                isAdmin: user.is_admin === 1,
                profilePhoto: user.profile_photo
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/auth/register', (req, res) => {
    try {
        const { username, password, firstName, lastName, defaultDepartment } = req.body;

        if (!username || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'Campos obrigatórios em falta' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Username deve ter pelo menos 3 caracteres' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
        }

        const existingUser = dbGet('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUser) {
            return res.status(400).json({ error: 'Username já existe' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        dbRun(
            'INSERT INTO users (username, password, first_name, last_name, default_department) VALUES (?, ?, ?, ?, ?)',
            [username, hashedPassword, firstName, lastName, defaultDepartment || null]
        );

        res.status(201).json({ message: 'Utilizador criado com sucesso' });
    } catch (error) {
        console.error('Erro no registo:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ==================== ROTAS DE UTILIZADORES ====================

app.get('/api/users', authenticateToken, (req, res) => {
    try {
        const users = dbAll(`
            SELECT id, username, first_name, last_name, default_department, is_admin, profile_photo, created_at
            FROM users ORDER BY first_name, last_name
        `);

        res.json(users.map(u => ({
            id: u.id,
            username: u.username,
            firstName: u.first_name,
            lastName: u.last_name,
            defaultDepartment: u.default_department,
            isAdmin: u.is_admin === 1,
            profilePhoto: u.profile_photo,
            createdAt: u.created_at
        })));
    } catch (error) {
        console.error('Erro ao obter utilizadores:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.get('/api/users/me', authenticateToken, (req, res) => {
    try {
        const user = dbGet(
            'SELECT id, username, first_name, last_name, default_department, is_admin, profile_photo FROM users WHERE id = ?',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({ error: 'Utilizador não encontrado' });
        }

        res.json({
            id: user.id,
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
            defaultDepartment: user.default_department,
            isAdmin: user.is_admin === 1,
            profilePhoto: user.profile_photo
        });
    } catch (error) {
        console.error('Erro ao obter perfil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/users/me', authenticateToken, (req, res) => {
    try {
        const { firstName, lastName, defaultDepartment, profilePhoto } = req.body;

        dbRun(
            'UPDATE users SET first_name = ?, last_name = ?, default_department = ?, profile_photo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [firstName, lastName, defaultDepartment, profilePhoto, req.user.id]
        );

        res.json({ message: 'Perfil atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/users/me/password', authenticateToken, (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        const user = dbGet('SELECT password FROM users WHERE id = ?', [req.user.id]);

        if (!bcrypt.compareSync(oldPassword, user.password)) {
            return res.status(400).json({ error: 'Password atual incorreta' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Nova password deve ter pelo menos 6 caracteres' });
        }

        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        dbRun('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedPassword, req.user.id]);

        res.json({ message: 'Password alterada com sucesso' });
    } catch (error) {
        console.error('Erro ao alterar password:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/users/:id/admin', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { isAdmin } = req.body;
        const userId = req.params.id;

        if (parseInt(userId) === req.user.id) {
            return res.status(400).json({ error: 'Não pode alterar o seu próprio estado de admin' });
        }

        dbRun('UPDATE users SET is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [isAdmin ? 1 : 0, userId]);

        res.json({ message: isAdmin ? 'Utilizador promovido a admin' : 'Admin removido do utilizador' });
    } catch (error) {
        console.error('Erro ao alterar admin:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ==================== ROTAS DE PROJETOS/OBRAS ====================

app.get('/api/projects', authenticateToken, (req, res) => {
    try {
        const { status } = req.query;
        
        let query = 'SELECT * FROM projects';
        let params = [];

        if (status && status !== 'all') {
            query += ' WHERE status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC';

        const projects = dbAll(query, params);

        res.json(projects.map(p => {
            const reopens = dbAll('SELECT * FROM project_reopens WHERE project_id = ? ORDER BY reopened_at', [p.id]);
            return {
                id: p.id,
                workCode: p.work_code,
                name: p.name,
                status: p.status,
                notes: p.notes,
                createdAt: p.created_at,
                closedAt: p.closed_at,
                reopenHistory: reopens.map(r => ({
                    id: r.id,
                    reason: r.reason,
                    comment: r.comment,
                    date: r.reopened_at
                }))
            };
        }));
    } catch (error) {
        console.error('Erro ao obter projetos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/projects', authenticateToken, (req, res) => {
    try {
        const { workCode, name, notes } = req.body;

        if (!workCode) {
            return res.status(400).json({ error: 'Código da obra é obrigatório' });
        }

        if (workCode.length < 5) {
            return res.status(400).json({ error: 'Código da obra deve ter pelo menos 5 caracteres' });
        }

        const existing = dbGet('SELECT id FROM projects WHERE work_code = ?', [workCode]);
        if (existing) {
            return res.status(400).json({ error: 'Já existe uma obra com este código' });
        }

        dbRun(
            'INSERT INTO projects (work_code, name, notes, created_by) VALUES (?, ?, ?, ?)',
            [workCode, name || null, notes || null, req.user.id]
        );

        const newProject = dbGet('SELECT * FROM projects WHERE work_code = ?', [workCode]);

        res.status(201).json({
            id: newProject.id,
            workCode,
            name,
            notes,
            status: 'open',
            message: 'Obra criada com sucesso'
        });
    } catch (error) {
        console.error('Erro ao criar projeto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/projects/:id/close', authenticateToken, (req, res) => {
    try {
        dbRun("UPDATE projects SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);
        res.json({ message: 'Obra fechada com sucesso' });
    } catch (error) {
        console.error('Erro ao fechar projeto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/projects/:id/reopen', authenticateToken, (req, res) => {
    try {
        const { reason, comment } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Motivo da reabertura é obrigatório' });
        }

        dbRun("UPDATE projects SET status = 'open', closed_at = NULL WHERE id = ?", [req.params.id]);
        dbRun(
            'INSERT INTO project_reopens (project_id, reason, comment, reopened_by) VALUES (?, ?, ?, ?)',
            [req.params.id, reason, comment || null, req.user.id]
        );

        res.json({ message: 'Obra reaberta com sucesso' });
    } catch (error) {
        console.error('Erro ao reabrir projeto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ==================== ROTAS DE SESSÕES DE TRABALHO ====================

app.get('/api/sessions', authenticateToken, (req, res) => {
    try {
        const { startDate, endDate, userId } = req.query;
        
        let query = `
            SELECT ws.*, p.work_code, p.name as project_name, u.first_name, u.last_name
            FROM work_sessions ws
            LEFT JOIN projects p ON ws.project_id = p.id
            LEFT JOIN users u ON ws.user_id = u.id
            WHERE 1=1
        `;
        let params = [];

        if (!req.user.isAdmin) {
            query += ' AND ws.user_id = ?';
            params.push(req.user.id);
        } else if (userId && userId !== 'all') {
            query += ' AND ws.user_id = ?';
            params.push(userId);
        }

        if (startDate) {
            query += ' AND ws.start_time >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND ws.end_time <= ?';
            params.push(endDate);
        }

        query += ' ORDER BY ws.start_time DESC';

        const sessions = dbAll(query, params);

        res.json(sessions.map(s => {
            const relatedProjects = dbAll(`
                SELECT p.work_code, p.name
                FROM session_related_projects srp
                JOIN projects p ON srp.project_id = p.id
                WHERE srp.session_id = ?
            `, [s.id]);

            return {
                id: s.id,
                odei: s.user_id,
                userName: `${s.first_name} ${s.last_name}`,
                workType: s.work_type,
                workCode: s.work_code,
                workName: s.project_name,
                projectId: s.project_id,
                projectType: s.project_type,
                subcategory: s.subcategory,
                internalCategory: s.internal_category,
                internalCategoryName: s.internal_category === 'reuniao' ? 'Reunião' : s.internal_category === 'formacao' ? 'Formação' : s.internal_category,
                internalDescription: s.internal_description,
                startTime: s.start_time,
                endTime: s.end_time,
                duration: s.duration,
                comment: s.comment,
                manualEntry: s.manual_entry === 1,
                relatedProjects
            };
        }));
    } catch (error) {
        console.error('Erro ao obter sessões:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/sessions', authenticateToken, (req, res) => {
    try {
        const { 
            workType, projectId, projectType, subcategory,
            internalCategory, internalDescription,
            startTime, endTime, duration, comment, manualEntry,
            relatedProjects
        } = req.body;

        dbRun(`
            INSERT INTO work_sessions (
                user_id, work_type, project_id, project_type, subcategory,
                internal_category, internal_description,
                start_time, end_time, duration, comment, manual_entry
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            req.user.id, workType, projectId || null, projectType || null, subcategory || null,
            internalCategory || null, internalDescription || null,
            startTime, endTime, duration, comment || null, manualEntry ? 1 : 0
        ]);

        const session = dbGet('SELECT last_insert_rowid() as id');
        const sessionId = session.id;

        if (relatedProjects && relatedProjects.length > 0) {
            relatedProjects.forEach(projId => {
                dbRun('INSERT INTO session_related_projects (session_id, project_id) VALUES (?, ?)', [sessionId, projId]);
            });
        }

        res.status(201).json({ id: sessionId, message: 'Sessão registada com sucesso' });
    } catch (error) {
        console.error('Erro ao criar sessão:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.put('/api/sessions/:id', authenticateToken, (req, res) => {
    try {
        const sessionId = req.params.id;
        const { 
            workType, projectId, projectType, subcategory,
            internalCategory, internalDescription,
            startTime, endTime, duration, comment,
            relatedProjects
        } = req.body;

        const session = dbGet('SELECT user_id FROM work_sessions WHERE id = ?', [sessionId]);
        
        if (!session) {
            return res.status(404).json({ error: 'Sessão não encontrada' });
        }

        if (session.user_id !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Sem permissão para editar esta sessão' });
        }

        dbRun(`
            UPDATE work_sessions SET
                work_type = ?, project_id = ?, project_type = ?, subcategory = ?,
                internal_category = ?, internal_description = ?,
                start_time = ?, end_time = ?, duration = ?, comment = ?
            WHERE id = ?
        `, [
            workType, projectId || null, projectType || null, subcategory || null,
            internalCategory || null, internalDescription || null,
            startTime, endTime, duration, comment || null,
            sessionId
        ]);

        dbRun('DELETE FROM session_related_projects WHERE session_id = ?', [sessionId]);
        
        if (relatedProjects && relatedProjects.length > 0) {
            relatedProjects.forEach(projId => {
                dbRun('INSERT INTO session_related_projects (session_id, project_id) VALUES (?, ?)', [sessionId, projId]);
            });
        }

        res.json({ message: 'Sessão atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar sessão:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.delete('/api/sessions/:id', authenticateToken, (req, res) => {
    try {
        const session = dbGet('SELECT user_id FROM work_sessions WHERE id = ?', [req.params.id]);
        
        if (!session) {
            return res.status(404).json({ error: 'Sessão não encontrada' });
        }

        if (session.user_id !== req.user.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Sem permissão para eliminar esta sessão' });
        }

        dbRun('DELETE FROM session_related_projects WHERE session_id = ?', [req.params.id]);
        dbRun('DELETE FROM work_sessions WHERE id = ?', [req.params.id]);

        res.json({ message: 'Sessão eliminada com sucesso' });
    } catch (error) {
        console.error('Erro ao eliminar sessão:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ==================== ROTAS DE CALENDÁRIO ====================

app.get('/api/calendar/:year', authenticateToken, (req, res) => {
    try {
        const { year } = req.params;
        const { userId } = req.query;

        let targetUserId = req.user.id;
        
        if (userId && req.user.isAdmin) {
            targetUserId = userId;
        }

        const entries = dbAll(
            "SELECT * FROM calendar_entries WHERE user_id = ? AND date LIKE ?",
            [targetUserId, `${year}%`]
        );

        const result = {};
        entries.forEach(e => {
            result[e.date] = { type: e.type, note: e.note };
        });

        res.json(result);
    } catch (error) {
        console.error('Erro ao obter calendário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/calendar', authenticateToken, (req, res) => {
    try {
        const { date, type, note } = req.body;

        // Verificar se já existe
        const existing = dbGet('SELECT id FROM calendar_entries WHERE user_id = ? AND date = ?', [req.user.id, date]);
        
        if (existing) {
            dbRun('UPDATE calendar_entries SET type = ?, note = ? WHERE id = ?', [type, note || null, existing.id]);
        } else {
            dbRun('INSERT INTO calendar_entries (user_id, date, type, note) VALUES (?, ?, ?, ?)', [req.user.id, date, type, note || null]);
        }

        res.json({ message: 'Entrada guardada com sucesso' });
    } catch (error) {
        console.error('Erro ao guardar no calendário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.get('/api/holidays', authenticateToken, (req, res) => {
    try {
        const holidays = dbAll('SELECT date, name FROM holidays');
        
        const result = {};
        holidays.forEach(h => {
            result[h.date] = h.name;
        });

        res.json(result);
    } catch (error) {
        console.error('Erro ao obter feriados:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ==================== ROTAS DE COMENTÁRIOS ====================

app.get('/api/projects/:id/comments', authenticateToken, (req, res) => {
    try {
        const comments = dbAll(`
            SELECT pc.*, u.first_name, u.last_name
            FROM project_comments pc
            JOIN users u ON pc.user_id = u.id
            WHERE pc.project_id = ?
            ORDER BY pc.created_at DESC
        `, [req.params.id]);

        res.json(comments.map(c => ({
            id: c.id,
            comment: c.comment,
            userName: `${c.first_name} ${c.last_name}`,
            createdAt: c.created_at
        })));
    } catch (error) {
        console.error('Erro ao obter comentários:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

app.post('/api/projects/:id/comments', authenticateToken, (req, res) => {
    try {
        const { comment } = req.body;

        if (!comment || !comment.trim()) {
            return res.status(400).json({ error: 'Comentário não pode estar vazio' });
        }

        dbRun(
            'INSERT INTO project_comments (project_id, user_id, comment) VALUES (?, ?, ?)',
            [req.params.id, req.user.id, comment.trim()]
        );

        res.status(201).json({ message: 'Comentário adicionado com sucesso' });
    } catch (error) {
        console.error('Erro ao adicionar comentário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ==================== ROTAS DE ESTATÍSTICAS ====================

app.get('/api/stats/overview', authenticateToken, requireAdmin, (req, res) => {
    try {
        const totalUsers = dbGet('SELECT COUNT(*) as count FROM users').count;
        const totalProjects = dbGet('SELECT COUNT(*) as count FROM projects').count;
        const openProjects = dbGet("SELECT COUNT(*) as count FROM projects WHERE status = 'open'").count;
        const totalSessions = dbGet('SELECT COUNT(*) as count FROM work_sessions').count;
        const totalHoursResult = dbGet('SELECT SUM(duration) as total FROM work_sessions');
        const totalHours = totalHoursResult.total || 0;

        res.json({
            totalUsers,
            totalProjects,
            openProjects,
            closedProjects: totalProjects - openProjects,
            totalSessions,
            totalHours: Math.round(totalHours / 3600)
        });
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ==================== ROTA DE SAÚDE ====================

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// ==================== ROTA PRINCIPAL ====================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../aplicacao/index.html'));
});

// ==================== INICIAR SERVIDOR ====================

async function startServer() {
    await initializeDatabase();
    
    app.listen(PORT, HOST, () => {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║                                                            ║');
        console.log('║   🚀 FOLHA DE CONTROLO DE OBRA - SERVIDOR                  ║');
        console.log('║                                                            ║');
        console.log(`║   ✅ Servidor a correr em: http://localhost:${PORT}            ║`);
        console.log('║                                                            ║');
        console.log('║   📋 Abra o browser e vá a:                                ║');
        console.log(`║      http://localhost:${PORT}                                  ║`);
        console.log('║                                                            ║');
        console.log('║   🔐 Login inicial:                                        ║');
        console.log('║      Utilizador: admin                                     ║');
        console.log('║      Password: admin123                                    ║');
        console.log('║                                                            ║');
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
    });
}

startServer().catch(console.error);
