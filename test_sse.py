import os
import requests
from sseclient import SSEClient
from app.tasks.analysis import process_analysis

# Start analysis job
analysis_id = 'test_123'
response = requests.post(
    'http://localhost:8000/analysis/start',
    json={'url': 'https://example.com'}
)

# Verify response
if response.status_code != 202:
    print(f'Error starting analysis: {response.text}')
    exit(1)

# Trigger processing
process_analysis.delay(analysis_id, 'https://example.com')

# Connect to SSE stream
try:
    messages = SSEClient(f'http://localhost:8000/analysis/{analysis_id}')
    print('Listening for real-time updates:')
    for msg in messages:
        if msg.event == 'progress':
            print(f'Progress: {msg.data}%')
        elif msg.event == 'completed':
            print(f'Final result: {msg.data}')
            break
        elif msg.event == 'error':
            print(f'Error: {msg.data}')
            break
except Exception as e:
    print(f'SSE Connection failed: {str(e)}')
