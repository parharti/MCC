const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String }, // 'entries'
  count: { type: Number, default: 0 }
}, { _id: false });

module.exports = mongoose.model('Counter', counterSchema);
