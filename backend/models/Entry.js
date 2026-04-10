const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
  sno: { type: Number, required: true },
  complaintId: { type: String, required: true },
  mediaType: { type: String, required: true, enum: ['social_media', 'print_media', 'electronic_media'] },
  newsLink: { type: String, default: '' },
  entryDate: { type: String, required: true },
  entryTime: { type: String, default: '' },
  districtId: { type: String, required: true, index: true },
  constituency: { type: String, default: '' },
  gist: { type: String, required: true },
  sourceOfComplaint: { type: String, default: '' },
  addedBy: { type: String, default: '' },
  category: { type: String, default: '', enum: ['', 'MCC Violation', 'Fake News', 'Negative News', 'Paid News'] },
  status: { type: String, default: 'Pending', enum: ['Pending', 'Replied', 'Closed', 'Dropped'], index: true },
  remark: { type: String, default: '' },
  immediateReply: { type: String, default: '' },
  repliedLink: { type: String, default: '' },
  finalReply: { type: String, default: '' },
  evidencePhotos: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true }
});

// Index for common queries
entrySchema.index({ districtId: 1, status: 1 });

module.exports = mongoose.model('Entry', entrySchema);
