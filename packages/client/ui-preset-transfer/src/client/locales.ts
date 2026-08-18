/** English product copy for the preset-transfer settings section. */
const en = {
  nav: 'Preset packages',
  intro: 'Move user-authored Agent Presets between DSH installations. Imported packages run with the same access as local presets.',
  import: 'Import package',
  exporting: 'Exporting...',
  importing: 'Importing...',
  chooseFile: 'Choose a .dshpreset file first.',
  idInvalid: 'Use lowercase letters, digits, and hyphens for the identifier.',
  id: 'Local identifier',
  idPlaceholder: 'my-preset',
  noUserPresets: 'No user-authored presets are available to export.',
  export: 'Export',
  imported: 'Preset package imported.',
  noWarnings: 'No archive warnings.',
  warningAbsolutePaths: 'Some files contain absolute paths and may need editing on this computer.',
  warningPossibleSecrets: 'Some files may contain API keys, tokens, or other secrets.',
  warningVersionMismatch: 'The package was exported by a different DSH version.',
  conflict: 'A preset named "{id}" already exists.',
  confirm: '{fileCount} files\n{warnings}\n\n{trustNotice}',
  security: 'Only import packages from a source you trust.',
  file: 'Package file',
  error: 'Preset package operation failed:',
  loading: 'Loading presets...',
  loadFailed: 'Could not load presets.',
} as const

/** Chinese product copy for the preset-transfer settings section. */
const zh = {
  nav: '预设包',
  intro: '在 DSH 安装之间转移用户创建的 Agent Preset。导入的预设拥有与本地预设相同的权限。',
  import: '导入预设包',
  exporting: '正在导出…',
  importing: '正在导入…',
  chooseFile: '请先选择 .dshpreset 文件。',
  idInvalid: '标识符只能使用小写字母、数字和连字符。',
  id: '本地标识符',
  idPlaceholder: 'my-preset',
  noUserPresets: '没有可导出的用户预设。',
  export: '导出',
  imported: '预设包已导入。',
  noWarnings: '未发现压缩包警告。',
  warningAbsolutePaths: '部分文件包含绝对路径，可能需要在此计算机上修改。',
  warningPossibleSecrets: '部分文件可能包含 API Key、令牌或其他密钥。',
  warningVersionMismatch: '此预设包由其他 DSH 版本导出。',
  conflict: '名为“{id}”的预设已存在。',
  confirm: '{fileCount} 个文件\n{warnings}\n\n{trustNotice}',
  security: '只导入来自可信来源的预设包。',
  file: '预设包文件',
  error: '预设包操作失败：',
  loading: '正在加载预设…',
  loadFailed: '无法加载预设。',
} as const

/** Keys shared by the English and Chinese preset-transfer dictionaries. */
export type PresetTransferKey = keyof typeof en
export { en, zh }
