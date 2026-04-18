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
    const headers = {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
    };

    try {
        // Step 1: Create the lead event in FUB
        const eventRes = await fetch('https://api.followupboss.com/v1/events', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                type: 'Property Inquiry',
                source: 'Leverage Playbook',
                person: {
                    firstName: firstName || '',
                    emails: [{ value: email }],
                },
            }),
        });

        if (!eventRes.ok) {
            const errorText = await eventRes.text();
            console.error('FUB events API error:', eventRes.status, errorText);
            return res.status(500).json({ error: 'Failed to create lead in FUB' });
        }

        const eventData = await eventRes.json();
        const personId = eventData?.person?.id;

        if (!personId) {
            console.error('No person ID returned from FUB event:', JSON.stringify(eventData));
            return res.status(200).json({ success: true, warning: 'Lead created but action plan not assigned' });
        }

        // Step 2: Find the action plan by name
        const plansRes = await fetch('https://api.followupboss.com/v1/actionPlans?limit=200', {
            method: 'GET',
            headers,
        });

        if (!plansRes.ok) {
            console.error('FUB action plans fetch error:', plansRes.status);
            return res.status(200).json({ success: true, warning: 'Lead created but could not fetch action plans' });
        }

        const plansData = await plansRes.json();
        const plans = plansData?.actionPlans || [];
        const plan = plans.find(p =>
            p.name && p.name.toLowerCase().includes('lead magnet')
        );

        if (!plan) {
            console.error('Action plan not found. Available plans:', plans.map(p => p.name));
            return res.status(200).json({ success: true, warning: 'Lead created but action plan not found' });
        }

        // Step 3: Assign the action plan to the person
        const assignRes = await fetch('https://api.followupboss.com/v1/actionPlansPeople', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                personId: personId,
                actionPlanId: plan.id,
            }),
        });

        if (!assignRes.ok) {
            const errorText = await assignRes.text();
            console.error('FUB action plan assign error:', assignRes.status, errorText);
            return res.status(200).json({ success: true, warning: 'Lead created but action plan assignment failed' });
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('Unexpected error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};
