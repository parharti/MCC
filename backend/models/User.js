const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: { type: String }, // 'admin' or district id like 'chennai'
  role: { type: String, required: true, enum: ['admin', 'district'] },
  username: { type: String, required: true },
  password: { type: String, required: true },
  districtId: { type: String },
  districtName: { type: String }
}, { _id: false });

module.exports = mongoose.model('User', userSchema);
