module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { firstName, email } = req.body || {};

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const apiKey = process.env.FUB_API_KEY;

    if (!apiKey) {
        console.error('FUB_API_KEY environment variable is not set');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const credentials = Buffer.from(`${apiKey}:`).toString('base64');

    try {
        const response = await fetch('https://api.followupboss.com/v1/people', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                firstName: firstName || '',
                emails: [{ value: email }],
                source: 'Leverage Playbook',
                tags: ['leverage-playbook'],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('FUB API error:', response.status, errorText);
            return res.status(500).json({ error: 'Failed to create contact in FUB' });
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('Unexpected error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};
