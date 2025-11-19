# PackMates Backend API

A Node.js backend API for the PackMates application with MongoDB integration.

## Features

- Express.js web framework
- MongoDB database with Mongoose ODM
- CORS enabled for cross-origin requests
- User management endpoints
- Environment variable configuration
- Development server with hot reload

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/packmates
NODE_ENV=development
```

3. Make sure MongoDB is running on your system

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### General
- `GET /` - API status and information
- `GET /health` - Health check endpoint

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (soft delete)

## Example API Usage

### Create a new user
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "bio": "Love hiking and outdoor adventures"
  }'
```

### Get all users
```bash
curl http://localhost:3000/api/users
```

## Project Structure

```
packmates-backend/
├── models/
│   └── User.js          # User data model
├── routes/
│   └── users.js         # User API routes
├── server.js            # Main server file
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `MONGODB_URI` - MongoDB connection string
- `NODE_ENV` - Environment (development/production)

