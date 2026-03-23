export interface MockSession {
  id: string
  title: string
  preview: string
  timestamp: string
  active?: boolean
}

export const mockSessions: MockSession[] = [
  {
    id: '1',
    title: 'Refactor auth module',
    preview: 'Split middleware into separate concerns and add token refresh logic',
    timestamp: '2 min ago',
    active: true,
  },
  {
    id: '2',
    title: 'Fix pagination bug',
    preview: 'Off-by-one error in cursor-based pagination for the users endpoint',
    timestamp: '1 hour ago',
  },
  {
    id: '3',
    title: 'Add dark mode support',
    preview: 'Implement system theme detection and CSS variable toggling',
    timestamp: '3 hours ago',
  },
  {
    id: '4',
    title: 'Database migration v2',
    preview: 'Add indexes to sessions table and migrate legacy user records',
    timestamp: 'Yesterday',
  },
  {
    id: '5',
    title: 'Setup CI pipeline',
    preview: 'Configure GitHub Actions for lint, test, and build on PR',
    timestamp: '2 days ago',
  },
]
