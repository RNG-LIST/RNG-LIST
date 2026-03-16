import { verifyToken, auditLog } from './_utils.js';
import { query } from './_db.js';
import { randomUUID } from 'crypto';

const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

async function verifyTurnstileToken(token) {
    try {
        const response = await fetch(TURNSTILE_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: TURNSTILE_SECRET, response: token })
        });
        const data = await response.json();
        return data.success === true;
    } catch (error) {
        return false;
    }
}

function sanitizeRecords(records) {
    if (!Array.isArray(records)) return [];
    const unique = [];
    const seen = new Set();
    
    const sorted = [...records].sort((a, b) => (b.percent || 0) - (a.percent || 0));
    
    for (const r of sorted) {
        if (!r.user) continue;
        const userKey = r.user.toLowerCase().trim();
        if (!seen.has(userKey)) {
            seen.add(userKey);
            unique.push(r);
        }
    }
    return unique;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { action } = req.query;
        await ensureSubmissionsTable();

        if (action === 'submit') {
            return handleSubmitRecord(req, res);
        } else if (action === 'submit-level') {
            return handleSubmitLevel(req, res);
        }

        const decoded = verifyToken(req);

        if (action === 'view') {
            return handleGetSubmissions(req, res, decoded);
        } else if (action === 'process') {
            return handleProcessSubmission(req, res, decoded);
        } else if (action === 'edit-submission') {
            return handleEditSubmission(req, res, decoded);
        } else if (!action || action === 'update') {
            return handleUpdateRecords(req, res, decoded);
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        res.status(error.message === 'No token provided' ? 401 : 500).json({ error: error.message });
    }
}

async function handleSubmitRecord(req, res) {
    try {
        const { levelName, username, percent, hz, discord, videoLink, notes, turnstileToken } = req.body;

        if (!turnstileToken) {
            return res.status(400).json({ error: 'Security verification failed. Please try again.' });
        }

        const isValidToken = await verifyTurnstileToken(turnstileToken);
        if (!isValidToken) {
            return res.status(400).json({ error: 'Security verification failed. Please try again.' });
        }

        if (!levelName || !username || percent === undefined || !videoLink) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (discord && discord.length < 2) {
            return res.status(400).json({ error: 'Invalid Discord username format' });
        }

        if (percent < 0 || percent > 100) {
            return res.status(400).json({ error: 'Percent must be between 0 and 100' });
        }

        if (!videoLink.startsWith('http')) {
            return res.status(400).json({ error: 'Invalid video link' });
        }

        const submissionId = randomUUID();
        const result = await query(
            `INSERT INTO public.submissions (id, level_name, username, percent, hz, discord, video_link, notes, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             RETURNING *`,
            [submissionId, levelName, username, percent, hz || null, discord, videoLink, notes || null, 'pending']
        );

        return res.status(201).json({
            success: true,
            message: 'Submission received successfully',
            submission: result.rows[0]
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleSubmitLevel(req, res) {
    try {
        const { name, id, author, verifier, verification, percentToQualify, placementSuggestion, notes, turnstileToken } = req.body;

        if (!turnstileToken) {
            return res.status(400).json({ error: 'Security verification failed. Please try again.' });
        }

        const isValidToken = await verifyTurnstileToken(turnstileToken);
        if (!isValidToken) {
            return res.status(400).json({ error: 'Security verification failed. Please try again.' });
        }

        if (!name || !id || !author || !verification) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (!verification.startsWith('http')) {
            return res.status(400).json({ error: 'Invalid verification video link' });
        }

        const submissionId = randomUUID();
        const result = await query(
            `INSERT INTO public.submissions (id, submission_type, name, id_gd, author, verifier, verification, percent_to_qualify, placement_suggestion, notes, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
             RETURNING *`,
            [submissionId, 'level', name, id, author, verifier || null, verification, percentToQualify || 100, placementSuggestion || null, notes || null, 'pending']
        );

        return res.status(201).json({
            success: true,
            message: 'Level submission received successfully',
            submission: result.rows[0]
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleGetSubmissions(req, res, decoded) {
    try {
        if (decoded.role !== 'mod' && decoded.role !== 'admin' && decoded.role !== 'management') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const result = await query(
            `SELECT * FROM public.submissions 
             WHERE status = 'pending'
             ORDER BY created_at ASC`
        );

        return res.status(200).json({
            success: true,
            submissions: result.rows || [],
            userRole: decoded.role
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleProcessSubmission(req, res, decoded) {
    try {
        if (decoded.role !== 'mod' && decoded.role !== 'admin' && decoded.role !== 'management') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { 
            id, action: subAction, reason, 
            placement_suggestion, name, author, verifier, percent_to_qualify, verification, id_gd,
            username, discord, percent, hz, video_link 
        } = req.body;

        if (!id || !subAction) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (subAction !== 'approve' && subAction !== 'deny') {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const submissionResult = await query('SELECT * FROM public.submissions WHERE id = $1', [id]);

        if (submissionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const submission = submissionResult.rows[0];
        const submissionType = submission.submission_type || 'record';

        if (submissionType === 'level' && decoded.role === 'mod') {
            return res.status(403).json({ error: 'Mods cannot approve level submissions' });
        }

        if (subAction === 'approve') {
            if (submission.submission_type === 'level') {
                const finalName = name !== undefined ? name : submission.name;
                const finalAuthorStr = author !== undefined ? author : submission.author;
                const finalVerifier = verifier !== undefined ? verifier : submission.verifier;
                const finalPercentToQualify = percent_to_qualify !== undefined ? parseInt(percent_to_qualify) : parseInt(submission.percent_to_qualify);
                const finalVerification = verification !== undefined ? verification : submission.verification;
                const finalPlacement = placement_suggestion !== undefined ? placement_suggestion : submission.placement_suggestion;
                const finalIdGd = id_gd !== undefined ? id_gd : submission.id_gd;

                const newLevelDbId = Date.now() + Math.floor(Math.random() * 1000);
                const newLevelUUID = randomUUID();
                const gdId = parseInt(finalIdGd) || null;

                let targetRank = parseInt(finalPlacement);
                
                if (isNaN(targetRank) || targetRank <= 0) {
                    const rankRes = await query(`SELECT MAX(rank) as max_rank FROM public.levels`);
                    targetRank = parseInt(rankRes.rows[0]?.max_rank || 0) + 1;
                } else {
                    await query(`UPDATE public.levels SET rank = rank + 1 WHERE rank >= $1`, [targetRank]);
                }
                
                const creators = finalAuthorStr ? finalAuthorStr.split(',').map(a => a.trim()).filter(a => a) : [];
                const finalAuthor = creators.length > 0 ? creators[0] : finalAuthorStr;

                const newLevelData = {
                    id: gdId, 
                    name: finalName,
                    author: finalAuthor,
                    creators: creators.length > 1 ? creators : [finalAuthor],
                    verifier: finalVerifier || null,
                    verification: finalVerification,
                    percentToQualify: finalPercentToQualify || 100,
                    password: "free Copyable",
                    records: [],
                    _id: newLevelUUID, 
                    rank: targetRank
                };

                await query(
                    `INSERT INTO public.levels (id, name, rank, data) VALUES ($1, $2, $3, $4)`,
                    [newLevelDbId, finalName, targetRank, newLevelData]
                );
                
                const normalizeQuery = `
                    WITH RankedLevels AS (
                        SELECT id, ROW_NUMBER() OVER (ORDER BY rank ASC, id ASC) as expected_rank
                        FROM public.levels
                    )
                    UPDATE public.levels
                    SET rank = RankedLevels.expected_rank
                    FROM RankedLevels
                    WHERE public.levels.id = RankedLevels.id AND public.levels.rank IS DISTINCT FROM RankedLevels.expected_rank;
                `;
                await query(normalizeQuery);

                await query(
                    `UPDATE public.submissions SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
                    ['approved', decoded.username, id]
                );

                await auditLog(decoded, 'APPROVE_LEVEL_SUBMISSION', {
                    submissionId: id,
                    levelName: finalName,
                    rank: targetRank
                });

            } else {
                const finalUsername = username !== undefined ? username : submission.username;
                const finalPercent = percent !== undefined ? parseInt(percent) : submission.percent;
                const finalHz = hz !== undefined ? parseInt(hz) : submission.hz;
                const finalVideoLink = video_link !== undefined ? video_link : submission.video_link;

                let levelResult = await query(
                    `SELECT id, data, name FROM public.levels WHERE name = $1`,
                    [submission.level_name]
                );

                if (levelResult.rows.length > 0) {
                    const levelData = levelResult.rows[0];
                    let records = levelData.data.records || [];
                    
                    const newRecord = {
                        user: finalUsername,
                        link: finalVideoLink,
                        percent: finalPercent,
                        hz: finalHz || 60
                    };
                    
                    records.push(newRecord);
                    records = sanitizeRecords(records);
                    
                    const updatedData = {
                        ...levelData.data,
                        records: records
                    };

                    await query(
                        `UPDATE public.levels SET data = $1 WHERE id = $2`,
                        [updatedData, levelData.id]
                    );
                }

                await query(
                    `UPDATE public.submissions SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
                    ['approved', decoded.username, id]
                );

                await auditLog(decoded, 'APPROVE_RECORD_SUBMISSION', {
                    submissionId: id,
                    levelName: submission.level_name,
                    username: finalUsername,
                    percent: finalPercent
                });
            }

        } else if (subAction === 'deny') {
            if (submissionType === 'level' && decoded.role === 'mod') {
                return res.status(403).json({ error: 'Mods cannot deny level submissions' });
            }

            await query(
                `UPDATE public.submissions SET status = $1, denial_reason = $2, reviewed_by = $3, reviewed_at = NOW() WHERE id = $4`,
                ['denied', reason || null, decoded.username, id]
            );

            await auditLog(decoded, 'DENY_SUBMISSION', {
                submissionId: id,
                name: submission.submission_type === 'level' ? submission.name : submission.level_name,
                username: submission.username,
                reason: reason || 'No reason provided'
            });
        }

        return res.status(200).json({
            success: true,
            message: `Submission ${subAction}d successfully`
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleEditSubmission(req, res, decoded) {
    try {
        if (decoded.role !== 'mod' && decoded.role !== 'admin' && decoded.role !== 'management') {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { id, levelName, username, percent, hz, discord, videoLink, notes, placement_suggestion,
                name, id_gd, author, verifier, verification, percent_to_qualify } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Submission ID required' });
        }

        const submissionResult = await query('SELECT * FROM public.submissions WHERE id = $1', [id]);

        if (submissionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        const originalSubmission = submissionResult.rows[0];

        const updates = [];
        const values = [];
        let paramCount = 1;

        if (levelName !== undefined) { updates.push(`level_name = $${paramCount++}`); values.push(levelName); }
        if (username !== undefined) { updates.push(`username = $${paramCount++}`); values.push(username); }
        if (percent !== undefined) { updates.push(`percent = $${paramCount++}`); values.push(percent); }
        if (hz !== undefined) { updates.push(`hz = $${paramCount++}`); values.push(hz); }
        if (discord !== undefined) { updates.push(`discord = $${paramCount++}`); values.push(discord); }
        if (videoLink !== undefined) { updates.push(`video_link = $${paramCount++}`); values.push(videoLink); }
        if (notes !== undefined) { updates.push(`notes = $${paramCount++}`); values.push(notes); }
        
        if (name !== undefined) { updates.push(`name = $${paramCount++}`); values.push(name); }
        if (id_gd !== undefined) { updates.push(`id_gd = $${paramCount++}`); values.push(id_gd); }
        if (author !== undefined) { updates.push(`author = $${paramCount++}`); values.push(author); }
        if (verifier !== undefined) { updates.push(`verifier = $${paramCount++}`); values.push(verifier); }
        if (verification !== undefined) { updates.push(`verification = $${paramCount++}`); values.push(verification); }
        if (percent_to_qualify !== undefined) { updates.push(`percent_to_qualify = $${paramCount++}`); values.push(percent_to_qualify); }
        if (placement_suggestion !== undefined) { updates.push(`placement_suggestion = $${paramCount++}`); values.push(placement_suggestion); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const updateQuery = `UPDATE public.submissions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        const result = await query(updateQuery, values);

        await auditLog(decoded, 'EDIT_SUBMISSION', {
            submissionId: id,
            originalData: originalSubmission,
            newData: result.rows[0]
        });

        return res.status(200).json({
            success: true,
            message: 'Submission updated successfully',
            submission: result.rows[0]
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

async function handleUpdateRecords(req, res, decoded) {
    try {
        if (decoded.role !== 'mod' && decoded.role !== 'admin' && decoded.role !== 'management') {
            return res.status(403).json({ error: 'Only admins, mods, and owners can update records' });
        }

        const { oldLevelId, newLevelData } = req.body;

        if (!oldLevelId || !newLevelData) return res.status(400).json({ error: 'Missing Data' });
        
        const findRes = await query(`SELECT id, name, rank, data FROM public.levels WHERE id = $1`, [oldLevelId]);

        if (findRes.rows.length === 0) {
            return res.status(404).json({ error: 'Level not found' });
        }

        const currentDBRow = findRes.rows[0];
        const oldContent = currentDBRow.data;

        const updatedContent = {
            ...oldContent,
            ...newLevelData
        };

        if (updatedContent.records) {
            updatedContent.records = sanitizeRecords(updatedContent.records);
        }

        const newName = updatedContent.name || currentDBRow.name;
        
        await query(
            `UPDATE public.levels SET data = $1, name = $2 WHERE id = $3`,
            [updatedContent, newName, oldLevelId]
        );

        await auditLog(decoded, "EDIT_LEVEL", {
            oldLevel: oldContent,
            newLevel: updatedContent,
            rank: currentDBRow.rank,
            notes: newLevelData.editNotes || null,
            reason: newLevelData.editReason || null
        });

        res.status(200).json({ success: true, level: updatedContent });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function ensureSubmissionsTable() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS public.submissions (
                id UUID PRIMARY KEY,
                submission_type VARCHAR(50) DEFAULT 'record',
                level_name VARCHAR(255),
                username VARCHAR(255),
                percent INTEGER,
                hz INTEGER,
                discord VARCHAR(255),
                video_link TEXT,
                notes TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                denial_reason TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                reviewed_by VARCHAR(255),
                reviewed_at TIMESTAMP,
                name VARCHAR(255),
                id_gd VARCHAR(255),
                author VARCHAR(255),
                verifier VARCHAR(255),
                verification TEXT,
                percent_to_qualify INTEGER,
                placement_suggestion TEXT
            )
        `);

        const columnChecks = [
            { name: 'submission_type', def: "VARCHAR(50) DEFAULT 'record'" },
            { name: 'name', def: 'VARCHAR(255)' },
            { name: 'id_gd', def: 'VARCHAR(255)' },
            { name: 'author', def: 'VARCHAR(255)' },
            { name: 'verifier', def: 'VARCHAR(255)' },
            { name: 'verification', def: 'TEXT' },
            { name: 'percent_to_qualify', def: 'INTEGER' },
            { name: 'placement_suggestion', def: 'TEXT' }
        ];

        for (const col of columnChecks) {
            try {
                await query(`ALTER TABLE public.submissions ADD COLUMN ${col.name} ${col.def}`);
            } catch (e) {}
        }

        try {
            await query(`ALTER TABLE public.submissions ALTER COLUMN level_name DROP NOT NULL`);
            await query(`ALTER TABLE public.submissions ALTER COLUMN username DROP NOT NULL`);
            await query(`ALTER TABLE public.submissions ALTER COLUMN percent DROP NOT NULL`);
            await query(`ALTER TABLE public.submissions ALTER COLUMN video_link DROP NOT NULL`);
            await query(`ALTER TABLE public.submissions ALTER COLUMN hz DROP NOT NULL`);
            await query(`ALTER TABLE public.submissions ALTER COLUMN discord DROP NOT NULL`);
        } catch (e) {}
    } catch (error) {
    }
}