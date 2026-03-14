// Pre-populated relocation tasks for US → India
export const CATEGORIES = [
  { id: 'visa', name: 'Visa & Immigration', icon: '🛂', color: '#059669' },
  { id: 'housing', name: 'Housing', icon: '🏠', color: '#2563eb' },
  { id: 'finances', name: 'Finances & Banking', icon: '💰', color: '#7c3aed' },
  { id: 'shipping', name: 'Shipping & Moving', icon: '📦', color: '#ea580c' },
  { id: 'employment', name: 'Employment', icon: '💼', color: '#be185d' },
  { id: 'healthcare', name: 'Healthcare', icon: '🏥', color: '#dc2626' },
  { id: 'utilities', name: 'Utilities & Services', icon: '🔌', color: '#0d9488' },
  { id: 'documents', name: 'Documents & Records', icon: '📄', color: '#4f46e5' },
  { id: 'family', name: 'Family & Education', icon: '👨‍👩‍👧‍👦', color: '#ca8a04' },
  { id: 'other', name: 'Other', icon: '📋', color: '#64748b' },
];

// Default family members for assignment dropdown (empty = user adds their own in Settings)
export const DEFAULT_FAMILY_MEMBERS = [];

export const INITIAL_TASKS = [
  // Visa & Immigration
  { id: '1', categoryId: 'visa', title: 'Apply for OCI (Overseas Citizen of India)', completed: false, comments: [{ id: 'c-1', text: 'Started process in Jan 2025', createdAt: '2025-01-15T00:00:00.000Z' }], dueDate: '2025-03-31', assignedTo: '', subtasks: [
    { id: '1-1', title: 'Gather required documents', completed: true, comments: [{ id: 'c-1-1', text: 'Passport copy done. Need birth cert.', createdAt: '2025-01-20T00:00:00.000Z' }], dueDate: '', assignedTo: '' },
    { id: '1-2', title: 'Fill online application', completed: false, comments: [{ id: 'c-1-2', text: 'Portal opens next week', createdAt: '2025-02-01T00:00:00.000Z' }], dueDate: '2025-02-15', assignedTo: '' },
    { id: '1-3', title: 'Schedule appointment at VFS/consulate', completed: false, comments: [], dueDate: '', assignedTo: '' },
  ], attachments: [] },
  { id: '2', categoryId: 'visa', title: 'Renew Indian passport if expiring soon', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '3', categoryId: 'visa', title: 'Get visa/status for non-Indian family members', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '4', categoryId: 'visa', title: 'Surrender US green card (if applicable)', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '5', categoryId: 'visa', title: 'File final US tax returns before departure', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },

  // Housing
  { id: '6', categoryId: 'housing', title: 'Sell or rent out US property', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [
    { id: '6-1', title: 'Get property appraisal', completed: false, notes: '', dueDate: '', assignedTo: '' },
    { id: '6-2', title: 'List with realtor or prepare for sale', completed: false, notes: '', dueDate: '', assignedTo: '' },
    { id: '6-3', title: 'Complete sale/rental paperwork', completed: false, notes: '', dueDate: '', assignedTo: '' },
  ], attachments: [] },
  { id: '7', categoryId: 'housing', title: 'Cancel/transfer US lease or mortgage', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '8', categoryId: 'housing', title: 'Find temporary housing in India', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '9', categoryId: 'housing', title: 'Arrange long-term housing in India', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '10', categoryId: 'housing', title: 'Update address with USPS mail forwarding', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },

  // Finances
  { id: '11', categoryId: 'finances', title: 'Open NRE/NRO bank account in India', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '12', categoryId: 'finances', title: 'Transfer funds to India (wire, Wise, etc.)', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '13', categoryId: 'finances', title: 'Close or maintain US bank accounts', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '14', categoryId: 'finances', title: 'Handle 401k/IRA (rollover or withdraw)', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '15', categoryId: 'finances', title: 'Update investment accounts for non-resident status', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '16', categoryId: 'finances', title: 'Cancel US credit cards or set up international use', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },

  // Shipping
  { id: '17', categoryId: 'shipping', title: 'Get quotes from international movers', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '18', categoryId: 'shipping', title: 'Create inventory of items to ship', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '19', categoryId: 'shipping', title: 'Arrange customs documentation for India', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '20', categoryId: 'shipping', title: 'Ship or sell vehicle', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '21', categoryId: 'shipping', title: 'Donate/sell items you won\'t take', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },

  // Employment
  { id: '22', categoryId: 'employment', title: 'Give notice to US employer', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '23', categoryId: 'employment', title: 'Transfer or cash out 401k', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '24', categoryId: 'employment', title: 'Get employment verification letter', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '25', categoryId: 'employment', title: 'Arrange remote work or India job (if applicable)', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },

  // Healthcare
  { id: '26', categoryId: 'healthcare', title: 'Get copies of medical records', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '27', categoryId: 'healthcare', title: 'Transfer prescriptions to India', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '28', categoryId: 'healthcare', title: 'Cancel US health insurance', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '29', categoryId: 'healthcare', title: 'Get travel insurance for move period', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '30', categoryId: 'healthcare', title: 'Research health insurance options in India', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },

  // Utilities
  { id: '31', categoryId: 'utilities', title: 'Cancel US electricity, gas, water', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '32', categoryId: 'utilities', title: 'Cancel internet and phone plans', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '33', categoryId: 'utilities', title: 'Set up India mobile number', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '34', categoryId: 'utilities', title: 'Update address for all subscriptions', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },

  // Documents
  { id: '35', categoryId: 'documents', title: 'Get documents apostilled/notarized', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '36', categoryId: 'documents', title: 'Birth certificates, marriage cert (if needed)', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '37', categoryId: 'documents', title: 'Education transcripts and degree copies', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '38', categoryId: 'documents', title: 'Update emergency contacts and beneficiaries', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },

  // Family
  { id: '39', categoryId: 'family', title: 'Enroll kids in India school', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '40', categoryId: 'family', title: 'Get school records transferred', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '41', categoryId: 'family', title: 'Pet relocation (vaccinations, travel crate)', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
  { id: '42', categoryId: 'family', title: 'Notify family and friends of new address', completed: false, notes: '', dueDate: '', assignedTo: '', subtasks: [], attachments: [] },
];
