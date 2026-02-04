const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './database.sqlite';

let db = null;

async function initializeDatabase() {
    const SQL = await initSqlJs();
    
    // Carregar base de dados existente ou criar nova
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
        console.log('✅ Base de dados carregada de', dbPath);
    } else {
        db = new SQL.Database();
        console.log('✅ Nova base de dados criada');
    }

    // Criar tabelas
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            default_department TEXT,
            is_admin INTEGER DEFAULT 0,
            profile_photo TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            work_code TEXT UNIQUE NOT NULL,
            name TEXT,
            status TEXT DEFAULT 'open',
            notes TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS project_reopens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            reason TEXT NOT NULL,
            comment TEXT,
            reopened_by INTEGER,
            reopened_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS work_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            work_type TEXT NOT NULL,
            project_id INTEGER,
            project_type TEXT,
            subcategory TEXT,
            internal_category TEXT,
            internal_description TEXT,
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            duration INTEGER NOT NULL,
            comment TEXT,
            manual_entry INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS session_related_projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            project_id INTEGER NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS project_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            comment TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS calendar_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            type TEXT NOT NULL,
            note TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS holidays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL
        )
    `);

    // Inserir feriados portugueses
    const holidays = [
        ['2025-01-01', 'Ano Novo'],
        ['2025-04-18', 'Sexta-feira Santa'],
        ['2025-04-20', 'Domingo de Páscoa'],
        ['2025-04-25', 'Dia da Liberdade'],
        ['2025-05-01', 'Dia do Trabalhador'],
        ['2025-06-10', 'Dia de Portugal'],
        ['2025-06-19', 'Corpo de Deus'],
        ['2025-08-15', 'Assunção de Nossa Senhora'],
        ['2025-10-05', 'Implantação da República'],
        ['2025-11-01', 'Dia de Todos os Santos'],
        ['2025-12-01', 'Restauração da Independência'],
        ['2025-12-08', 'Imaculada Conceição'],
        ['2025-12-25', 'Natal'],
        ['2026-01-01', 'Ano Novo'],
        ['2026-04-03', 'Sexta-feira Santa'],
        ['2026-04-05', 'Domingo de Páscoa'],
        ['2026-04-25', 'Dia da Liberdade'],
        ['2026-05-01', 'Dia do Trabalhador'],
        ['2026-06-04', 'Corpo de Deus'],
        ['2026-06-10', 'Dia de Portugal'],
        ['2026-08-15', 'Assunção de Nossa Senhora'],
        ['2026-10-05', 'Implantação da República'],
        ['2026-11-01', 'Dia de Todos os Santos'],
        ['2026-12-01', 'Restauração da Independência'],
        ['2026-12-08', 'Imaculada Conceição'],
        ['2026-12-25', 'Natal']
    ];

    holidays.forEach(([date, name]) => {
        try {
            db.run('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)', [date, name]);
        } catch (e) {}
    });

    // Criar admin padrão se não existir
    const adminCheck = db.exec("SELECT id FROM users WHERE username = 'admin'");
    
    if (adminCheck.length === 0 || adminCheck[0].values.length === 0) {
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.run(
            "INSERT INTO users (username, password, first_name, last_name, is_admin) VALUES (?, ?, ?, ?, ?)",
            ['admin', hashedPassword, 'Admin', 'Sistema', 1]
        );
        console.log('✅ Utilizador admin criado (password: admin123)');
    }

    // Guardar base de dados
    saveDatabase();
    
    console.log('✅ Base de dados inicializada com sucesso');
    
    return db;
}

function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

function getDb() {
    return db;
}

// Funções auxiliares para queries
function dbRun(sql, params = []) {
    db.run(sql, params);
    saveDatabase();
}

function dbGet(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
    }
    stmt.free();
    return null;
}

function dbAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

function dbExec(sql) {
    return db.exec(sql);
}

module.exports = { 
    initializeDatabase, 
    getDb, 
    saveDatabase,
    dbRun,
    dbGet,
    dbAll,
    dbExec
};
