const express = require('express');
const router = express.Router();
const userController = require('../api/activities/controllers/userController');
const {
  validateCreateUser,
  validateUpdateUser,
  validateGetUserById,
  validateDeleteUser,
  validateSearchUsers
} = require('../api/activities/validations/userValidation');

// GET /api/users - Get all users
router.get('/', userController.getAllUsers);

// GET /api/users/search - Search users
router.get('/search', validateSearchUsers, userController.searchUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', validateGetUserById, userController.getUserById);

// POST /api/users - Create new user
router.post('/', validateCreateUser, userController.createUser);

// PUT /api/users/:id - Update user
router.put('/:id', validateUpdateUser, userController.updateUser);

// DELETE /api/users/:id - Delete user (soft delete)
router.delete('/:id', validateDeleteUser, userController.deleteUser);

module.exports = router;
