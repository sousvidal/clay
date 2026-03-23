export type GitStatus = 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed' | 'conflict'

export interface FileTreeNode {
  name: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
  gitStatus?: GitStatus
  isOpen?: boolean
}

export const mockFileTree: FileTreeNode[] = [
  {
    name: 'src',
    type: 'folder',
    children: [
      {
        name: 'components',
        type: 'folder',
        children: [
          { name: 'App.tsx', type: 'file', gitStatus: 'modified', isOpen: true },
          { name: 'Header.tsx', type: 'file' },
          { name: 'Sidebar.tsx', type: 'file', gitStatus: 'modified' },
          { name: 'Footer.tsx', type: 'file', gitStatus: 'added' },
        ],
      },
      {
        name: 'hooks',
        type: 'folder',
        children: [
          { name: 'useAuth.ts', type: 'file' },
          { name: 'useTheme.ts', type: 'file', gitStatus: 'modified' },
          { name: 'useVirtualList.ts', type: 'file', gitStatus: 'untracked' },
        ],
      },
      {
        name: 'lib',
        type: 'folder',
        children: [
          { name: 'api.ts', type: 'file' },
          { name: 'utils.ts', type: 'file' },
          { name: 'constants.ts', type: 'file', gitStatus: 'added' },
        ],
      },
      {
        name: 'styles',
        type: 'folder',
        children: [
          { name: 'globals.css', type: 'file' },
          { name: 'components.css', type: 'file', gitStatus: 'modified' },
          { name: 'themes.css', type: 'file', gitStatus: 'untracked' },
        ],
      },
      { name: 'index.ts', type: 'file' },
      { name: 'main.tsx', type: 'file', gitStatus: 'modified' },
      { name: 'env.d.ts', type: 'file' },
    ],
  },
  {
    name: 'public',
    type: 'folder',
    children: [
      { name: 'favicon.ico', type: 'file' },
      { name: 'robots.txt', type: 'file' },
      { name: 'logo.svg', type: 'file' },
    ],
  },
  {
    name: 'tests',
    type: 'folder',
    children: [
      { name: 'setup.ts', type: 'file' },
      { name: 'App.test.tsx', type: 'file', gitStatus: 'modified' },
      { name: 'utils.test.ts', type: 'file' },
    ],
  },
  { name: '.env', type: 'file' },
  { name: '.gitignore', type: 'file' },
  { name: 'package.json', type: 'file', gitStatus: 'modified' },
  { name: 'package-lock.json', type: 'file', gitStatus: 'modified' },
  { name: 'tsconfig.json', type: 'file' },
  { name: 'vite.config.ts', type: 'file' },
  { name: 'README.md', type: 'file' },
]
