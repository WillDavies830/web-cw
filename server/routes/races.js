/**
 * API endpoints for race management
 */

const express = require('express');
const { runQuery, getQuery, allQuery } = require('../db');

const router = express.Router();

// Get all races
router.get('/', async (req, res) => {
  try {
    const races = await allQuery('SELECT * FROM races ORDER BY created_at DESC');
    res.json(races);
  } catch (error) {
    console.error('Error fetching races:', error);
    res.status(500).json({ error: 'Failed to fetch races' });
  }
});

// Get a specific race
router.get('/:id', async (req, res) => {
  try {
    const race = await getQuery('SELECT * FROM races WHERE id = ?', [req.params.id]);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    res.json(race);
  } catch (error) {
    console.error('Error fetching race:', error);
    res.status(500).json({ error: 'Failed to fetch race' });
  }
});

// Create a new race
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Race name is required' });
  }
  
  try {
    const result = await runQuery(
      'INSERT INTO races (name, description, status) VALUES (?, ?, ?)',
      [name, description || '', 'pending']
    );
    
    const newRace = await getQuery('SELECT * FROM races WHERE id = ?', [result.lastID]);
    res.status(201).json(newRace);
  } catch (error) {
    console.error('Error creating race:', error);
    res.status(500).json({ error: 'Failed to create race' });
  }
});

// Update a race
router.put('/:id', async (req, res) => {
  const { name, description, status } = req.body;
  const raceId = req.params.id;
  
  try {
    // Check if race exists
    const race = await getQuery('SELECT * FROM races WHERE id = ?', [raceId]);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    // Update race
    await runQuery(
      'UPDATE races SET name = ?, description = ?, status = ? WHERE id = ?',
      [
        name || race.name,
        description !== undefined ? description : race.description,
        status || race.status,
        raceId
      ]
    );
    
    const updatedRace = await getQuery('SELECT * FROM races WHERE id = ?', [raceId]);
    res.json(updatedRace);
  } catch (error) {
    console.error('Error updating race:', error);
    res.status(500).json({ error: 'Failed to update race' });
  }
});

// Start a race
router.post('/:id/start', async (req, res) => {
  const raceId = req.params.id;
  const startTime = Math.floor(Date.now() / 1000); // Current time in seconds
  
  try {
    // Check if race exists
    const race = await getQuery('SELECT * FROM races WHERE id = ?', [raceId]);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    if (race.status === 'active' || race.status === 'completed') {
      return res.status(400).json({ error: 'Race has already been started' });
    }
    
    // Start race
    await runQuery(
      'UPDATE races SET status = ?, start_time = ? WHERE id = ?',
      ['active', startTime, raceId]
    );
    
    const updatedRace = await getQuery('SELECT * FROM races WHERE id = ?', [raceId]);
    res.json(updatedRace);
  } catch (error) {
    console.error('Error starting race:', error);
    res.status(500).json({ error: 'Failed to start race' });
  }
});

// End a race
router.post('/:id/end', async (req, res) => {
  const raceId = req.params.id;
  
  try {
    // Check if race exists and is active
    const race = await getQuery('SELECT * FROM races WHERE id = ?', [raceId]);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    if (race.status !== 'active') {
      return res.status(400).json({ error: 'Race is not active' });
    }
    
    // End race
    await runQuery(
      'UPDATE races SET status = ? WHERE id = ?',
      ['completed', raceId]
    );
    
    const updatedRace = await getQuery('SELECT * FROM races WHERE id = ?', [raceId]);
    res.json(updatedRace);
  } catch (error) {
    console.error('Error ending race:', error);
    res.status(500).json({ error: 'Failed to end race' });
  }
});

// Delete a race
router.delete('/:id', async (req, res) => {
  const raceId = req.params.id;
  
  try {
    // Check if race exists
    const race = await getQuery('SELECT * FROM races WHERE id = ?', [raceId]);
    
    if (!race) {
      return res.status(404).json({ error: 'Race not found' });
    }
    
    // Delete race and related data (cascading delete not supported in SQLite by default)
    await runQuery('DELETE FROM checkpoint_results WHERE checkpoint_id IN (SELECT id FROM checkpoints WHERE race_id = ?)', [raceId]);
    await runQuery('DELETE FROM checkpoints WHERE race_id = ?', [raceId]);
    await runQuery('DELETE FROM race_results WHERE race_id = ?', [raceId]);
    await runQuery('DELETE FROM runners WHERE race_id = ?', [raceId]);
    await runQuery('DELETE FROM races WHERE id = ?', [raceId]);
    
    res.json({ message: 'Race deleted successfully' });
  } catch (error) {
    console.error('Error deleting race:', error);
    res.status(500).json({ error: 'Failed to delete race' });
  }
});

module.exports = router;