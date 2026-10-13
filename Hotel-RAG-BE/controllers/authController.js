const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// [POST] /api/auth/register
exports.register = async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email đã tồn tại' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      phone,
      role: 'Customer',
      status: 'Active'
    });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secretKey');
    res.status(201).json({ success: true, token, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// [POST] /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Tài khoản không tồn tại' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Mật khẩu không đúng' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secretKey');
    res.status(200).json({ success: true, token, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};