# 🌿 Medicinal Plants Database

[![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3.3-green.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![SQLite](https://img.shields.io/badge/SQLite-3-lightgrey.svg)](https://www.sqlite.org/)

A modern, accessible web application that provides comprehensive information about various medicinal plants, their therapeutic uses, preparation methods, and safety guidelines.

## 📑 Table of Contents

- [Features](#-features)
- [Technologies Used](#️-technologies-used)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Docker Deployment](#-docker-deployment)
- [Project Structure](#-project-structure)
- [Admin Panel](#-admin-panel)
- [Configuration](#-configuration)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)
- [Support](#-support)

## 🌿 Features

- **Comprehensive Plant Information**: Details on medicinal plants including scientific names, medicinal uses, preparation methods, parts used, regions, and precautions
- **Modern UI/UX**: Clean, responsive design with intuitive navigation and pleasant visual aesthetics
- **Accessibility**: ARIA attributes, semantic HTML, keyboard navigation, and screen reader support
- **Advanced Search**: Dynamic, debounced search to filter plants by name or use with advanced filtering options
- **Dark Mode**: Toggle between light and dark themes with user preference persistence
- **Admin Dashboard**: Full-featured admin panel for managing plants, users, and system settings
- **User Management**: User registration, authentication, and role-based access control
- **Image Management**: Upload and manage plant images with drag-and-drop support
- **Analytics**: Growth analytics and activity tracking
- **Responsive Design**: Optimized for all device sizes from mobile to desktop
- **Performance Optimized**: Efficient rendering, lazy loading, and optimized animations

## 🛠️ Technologies Used

- **Backend**: Flask (Python), SQLAlchemy
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Database**: SQLite (with SQLAlchemy ORM)
- **Icons**: Font Awesome
- **Fonts**: Montserrat, Roboto (Google Fonts)
- **Deployment**: Docker, Gunicorn

## 📋 Prerequisites

- Python 3.7 or higher
- pip (Python package manager)
- (Optional) Docker and Docker Compose for containerized deployment

## ⚡ Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/Medicinal_Plants_DB.git
cd Medicinal_Plants_DB

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Initialize database (optional)
python seed_data.py

# Run the application
python app.py
```

Visit `http://127.0.0.1:5000` in your browser. Default admin credentials: `admin` / `admin123`

## 🚀 Getting Started

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Medicinal_Plants_DB.git
   cd Medicinal_Plants_DB
   ```

2. **Create a virtual environment** (recommended)
   ```bash
   python -m venv venv
   
   # On Windows:
   venv\Scripts\activate
   
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables** (optional)
   
   Create a `.env` file or set environment variables:
   ```bash
   export SECRET_KEY="your-secret-key-here"
   export DATABASE_URL="sqlite:///instance/medicinal_plants.db"
   ```

5. **Initialize the database and seed data** (optional)
   ```bash
   python seed_data.py
   ```

6. **Run the application**
   ```bash
   python app.py
   ```

7. **Access the application**
   - Main application: `http://127.0.0.1:5000`
   - Admin panel: `http://127.0.0.1:5000/admin`
   - Default admin credentials: `admin` / `admin123` (change after first login!)

## 🐳 Docker Deployment

### Using Docker

1. **Build the Docker image**
   ```bash
   docker build -t medicinal-plants-db .
   ```

2. **Run the container**
   ```bash
   docker run -p 5000:5000 medicinal-plants-db
   ```

The application will be available at `http://localhost:5000`

## 📁 Project Structure

```
medicinal-plants-db/
├── app.py                      # Main Flask application
├── seed_data.py                # Database seeding script
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Docker configuration
├── .gitignore                  # Git ignore rules
├── README.md                   # This file
├── config/                     # Configuration files (gitignored)
│   ├── admin_config.json       # Admin user configuration
│   ├── admin_settings.json     # Admin panel settings
│   ├── users.json              # User data (JSON backup)
│   └── logs.json               # Application logs
├── instance/                   # Database instance (gitignored)
│   └── medicinal_plants.db     # SQLite database
├── static/
│   ├── css/                    # Stylesheets
│   │   ├── styles.css          # Main styles
│   │   ├── admin.css           # Admin panel styles
│   │   ├── home.css            # Home page styles
│   │   ├── plants.css          # Plants page styles
│   │   ├── search.css          # Search page styles
│   │   └── stats.css           # Statistics styles
│   ├── js/                     # JavaScript files
│   │   ├── app.js              # Main application JS
│   │   ├── admin.js            # Admin panel JS
│   │   ├── search.js           # Search functionality
│   │   ├── search-advanced.js  # Advanced search features
│   │   └── growth-analytics.js # Analytics and charts
│   ├── images/                 # Image assets
│   │   ├── uploads/            # User-uploaded images
│   │   └── ...                 # Plant images
│   └── data/
│       └── plants.json         # Plant data (JSON)
└── templates/                  # Flask templates
    ├── main/                   # Main application templates
    │   ├── index.html
    │   ├── plants.html
    │   └── search.html
    └── admin/                  # Admin panel templates
        ├── admin.html
        ├── login.html
        ├── register.html
        └── image_management.html
```

## 🔐 Admin Panel

The admin panel provides comprehensive management capabilities:

- **User Management**: Create, edit, and delete users with role-based permissions
- **Plant Management**: Add, update, and remove medicinal plant entries
- **Image Management**: Upload and manage plant images with drag-and-drop
- **Analytics Dashboard**: View growth analytics and user activity
- **System Settings**: Configure application settings and preferences
- **Activity Logs**: Monitor user actions and system events

### Admin Features

- Modern, responsive admin interface with dark mode support
- Theme toggle with localStorage persistence
- Drag-and-drop file uploads with image preview
- Bulk operations for efficient management
- Debounced search with keyboard shortcuts
- Chart.js integration for data visualization
- Accessible design with ARIA attributes

## 📝 Adding New Plants

Plants can be added through:

1. **Admin Panel** (recommended): Use the admin interface to add plants with images
2. **JSON File**: Edit `static/data/plants.json` directly
3. **Database**: Use SQLAlchemy models to add plants programmatically

### Plant Data Structure

```json
{
  "id": "plant-id",
  "common_name": "Plant Name",
  "scientific_name": "Scientific Name",
  "medicinal_uses": "Medicinal uses of the plant",
  "preparation_method": "How to prepare the plant for use",
  "parts_used": "Which parts of the plant are used",
  "region": "Where the plant is commonly found",
  "precautions": "Safety precautions when using the plant",
  "image_url": "/static/images/plant_image.jpg",
  "date_added": "2024-01-01"
}
```

## 🔧 Configuration

### Environment Variables

- `SECRET_KEY`: Flask secret key for session management (required for production)
- `DATABASE_URL`: Database connection string (defaults to SQLite)

### Admin Configuration

Admin credentials can be configured in `config/admin_config.json`:

```json
{
  "username": "admin",
  "email": "admin@example.com",
  "password_hash": "hashed-password"
}
```

**⚠️ Security Note**: Change default admin credentials immediately after installation!

## 🧪 Development

### Running in Development Mode

```bash
export FLASK_ENV=development
export FLASK_DEBUG=1
python app.py
```

### Seeding Test Data

```bash
python seed_data.py
```

This will create:
- Admin user and test users
- Sample plant data with dates
- Activity logs for testing

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Icons by [Font Awesome](https://fontawesome.com)
- Fonts by [Google Fonts](https://fonts.google.com)
- Charts by [Chart.js](https://www.chartjs.org/)

## 📞 Support

For issues, questions, or contributions, please open an issue on the GitHub repository.

## ⚠️ Important Notes

- **Security**: Change the default admin credentials (`admin` / `admin123`) immediately after installation!
- **Secret Key**: Update the `SECRET_KEY` in production environments. Never commit sensitive keys to version control.
- **Database**: The SQLite database is stored in the `instance/` directory and is gitignored by default.
- **Configuration**: Sensitive configuration files in `config/` are gitignored. Create them locally as needed.

## 🚨 Security Best Practices

1. **Change Default Credentials**: Always change default admin credentials before deploying
2. **Use Environment Variables**: Store sensitive data (SECRET_KEY, passwords) in environment variables
3. **HTTPS in Production**: Always use HTTPS in production environments
4. **Regular Updates**: Keep dependencies updated for security patches
5. **Database Backups**: Regularly backup your database files

---

**Note**: This application is for educational and informational purposes. Always consult with healthcare professionals before using medicinal plants for therapeutic purposes.