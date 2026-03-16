import { query } from './_db.js';
import { verifyToken } from './_utils.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        try {
            const result = await query("SELECT data FROM public.system WHERE key = '_editors'");
            if (result.rows.length === 0) return res.json([]);
            res.status(200).json(result.rows[0].data);
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch editors" });
        }
        return;
    }

    if (req.method === 'POST') {
        try {
            const decoded = verifyToken(req);
            if (!decoded || decoded.role !== 'management') {
                return res.status(403).json({ error: "Only management can edit the editors list" });
            }

            const editorsData = req.body;
            
            await query(
                "INSERT INTO public.system (key, data) VALUES ('_editors', $1) ON CONFLICT (key) DO UPDATE SET data = $1",
                [JSON.stringify(editorsData)]
            );
            
            res.status(200).json({ success: true, message: "Editors list saved" });
        } catch (error) {
            res.status(500).json({ error: "Failed to save editors", details: error.message });
        }
        return;
    }

    res.status(405).json({ error: "Method not allowed" });
}