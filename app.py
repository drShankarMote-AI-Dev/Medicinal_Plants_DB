import os
import json
import threading
import hashlib
from datetime import datetime, timedelta
from collections import Counter
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, get_flashed_messages, make_response, send_file
import io
import csv
from flask_sqlalchemy import SQLAlchemy
from functools import wraps
import secrets
from werkzeug.utils import secure_filename
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
from whitenoise import WhiteNoise

# Database models
db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    is_admin = db.Column(db.Boolean, default=False)
    avatar = db.Column(db.String(200), default='default_avatar.png')

    def __repr__(self):
        return '<User %r>' % self.username

# Configuration
# Configuration
WRITABLE_DIR = '/tmp' if os.environ.get('VERCEL') else '.'

USERS_FILE = os.path.join(WRITABLE_DIR, 'users.json')
SETTINGS_FILE = os.path.join(WRITABLE_DIR, 'admin_settings.json')
LOG_FILE = os.path.join(WRITABLE_DIR, 'logs.json')
USERS_LOCK = threading.Lock()
SETTINGS_LOCK = threading.Lock()

def create_app():
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
    app.wsgi_app = WhiteNoise(app.wsgi_app, root=os.path.join(os.path.dirname(__file__), 'static'), prefix='static/')
    
    # Configuration
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-this')
    
    # Use absolute path for database
    if os.environ.get('VERCEL'):
        db_path = os.path.join(WRITABLE_DIR, 'medicinal_plants.db')
    else:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'medicinal_plants.db')
    
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', f'sqlite:///{db_path}')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize database
    db.init_app(app)

    
    
    # Add CSRF token function to template context
    @app.context_processor
    def inject_csrf_token():
        if 'csrf_token' not in session:
            session['csrf_token'] = secrets.token_urlsafe(32)
        return dict(csrf_token=session['csrf_token'])
    
    # Create database tables and directories
    with app.app_context():
        if not os.environ.get('VERCEL'):
            if not os.path.exists('config'):
                os.makedirs('config')
            if not os.path.exists('instance'):
                os.makedirs('instance')
        db.create_all()
        
        # Ensure admin user exists and has correct password
        admin_username = 'admin'
        admin_password = 'admin123' # Default fallback password
        admin_email = 'admin@site.com'
        
        password_hash_from_config = None
        try:
            with open('config/admin_config.json', 'r') as f:
                admin_config = json.load(f)
                admin_username = admin_config.get('username', 'admin')
                password_hash_from_config = admin_config.get('password_hash')
                admin_email = admin_config.get('email', 'admin@site.com')
                print(f"Loading admin config from file: username='{admin_username}'")
        except (FileNotFoundError, json.JSONDecodeError, KeyError) as e:
            print(f"Config file not found or invalid, using default admin credentials: {e}")
        
        # Determine the password hash to use
        if password_hash_from_config:
            target_password_hash = password_hash_from_config
        else:
            target_password_hash = hashlib.sha256(admin_password.encode()).hexdigest()

        admin_user = User.query.filter_by(username=admin_username).first()

        if admin_user:
            # Admin user exists, update password if different
            if admin_user.password_hash != target_password_hash:
                admin_user.password_hash = target_password_hash
                db.session.commit()
                print(f"Admin user '{admin_username}' password hash updated.")
        else:
            # Admin user does not exist, create it
            admin_user = User(
                username=admin_username,
                email=admin_email,
                password_hash=target_password_hash,
                is_admin=True
            )
            db.session.add(admin_user)
            db.session.commit()
            print(f"Admin user created: username='{admin_username}', email='{admin_email}'")
    
    # Helper functions
    def login_required(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return redirect(url_for('login'))
            return f(*args, **kwargs)
        return decorated_function
    
    def log_action(action, user=None, details=None):
        """Log user actions"""
        if not os.environ.get('VERCEL') and not os.path.exists('config'):
            os.makedirs('config')
        
        log_entry = {
            'timestamp': datetime.now().isoformat(),
            'action': action,
            'user': user,
            'details': details or {}
        }
        
        logs = []
        if os.path.exists(LOG_FILE):
            try:
                with open(LOG_FILE, 'r', encoding='utf-8') as f:
                    logs = json.load(f)
            except:
                logs = []
        
        logs.append(log_entry)
        
        # Keep only last 1000 logs
        if len(logs) > 1000:
            logs = logs[-1000:]
        
        with open(LOG_FILE, 'w', encoding='utf-8') as f:
            json.dump(logs, f, indent=2, ensure_ascii=False)
    
    def load_users():
        if not os.path.exists(USERS_FILE):
            return []
        try:
            with open(USERS_FILE, 'r') as f:
                return json.load(f)
        except:
            return []
    
    def save_users(users):
        with USERS_LOCK:
            with open(USERS_FILE, 'w') as f:
                json.dump(users, f, indent=2)
    
    def load_settings():
        if not os.path.exists(SETTINGS_FILE):
            # Default settings
            settings = {
                'site_title': 'Medicinal Plants DB',
                'theme': 'default',
                'notifications_enabled': True
            }
            with open(SETTINGS_FILE, 'w') as f:
                json.dump(settings, f, indent=2)
            return settings
        
        try:
            with open(SETTINGS_FILE, 'r') as f:
                return json.load(f)
        except:
            return {
                'site_title': 'Medicinal Plants DB',
                'theme': 'default',
                'notifications_enabled': True
            }
    
    def save_settings(settings):
        with SETTINGS_LOCK:
            with open(SETTINGS_FILE, 'w') as f:
                json.dump(settings, f, indent=2)
    
    def csrf_required(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if request.method == 'POST' or request.method == 'PUT' or request.method == 'DELETE':
                token = request.headers.get('X-CSRF-Token')
                if not token:
                    return jsonify({'error': 'CSRF token missing'}), 400
                # In a real app, you should compare the token with the one stored in the session
            return f(*args, **kwargs)
        return decorated_function

    # Add flashed messages to context for JS consumption
    @app.context_processor
    def inject_flashed_messages():
        messages = []
        for category, message in get_flashed_messages(with_categories=True):
            messages.append({'message': message, 'category': category})
        return dict(flashed_messages_json=json.dumps(messages))

    # Routes
    @app.route('/')
    def index():
        """Render the home page with featured plants."""
        try:
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
                # Get 6 most recently added plants as featured plants
                featured_plants = sorted(
                    [p for p in plants if 'date_added' in p],
                    key=lambda p: p.get('date_added', ''),
                    reverse=True
                )[:6]
        except (FileNotFoundError, json.JSONDecodeError):
            plants = []
            featured_plants = []
        return render_template('main/index.html', plants=plants, featured_plants=featured_plants)

    @app.route('/search', endpoint='search_page')
    def search_page():
        """Render the search page."""
        query = request.args.get('q', '')
        
        try:
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            plants = []

        regions = sorted(list(set(p['region'] for p in plants if 'region' in p)))
        habitats = sorted(list(set(p['habitat'] for p in plants if 'habitat' in p and p['habitat'].strip())))
        preparation_methods = sorted(list(set(p['preparation_method'] for p in plants if 'preparation_method' in p and p['preparation_method'].strip())))
        parts_used = sorted(list(set(p['parts_used'] for p in plants if 'parts_used' in p)))
        
        # Extract unique medicinal uses (splitting by comma if needed)
        medicinal_uses = set()
        for p in plants:
            if 'medicinal_uses' in p:
                # Split by comma and strip whitespace
                uses = [use.strip() for use in p['medicinal_uses'].split(',')]
                medicinal_uses.update(uses)
        
        medicinal_uses = sorted(list(medicinal_uses))

        return render_template('main/search.html', query=query, regions=regions, habitats=habitats, 
                             preparation_methods=preparation_methods, parts_used=parts_used, 
                             medicinal_uses=medicinal_uses)


    @app.route('/api/search-plants', methods=['POST'])
    def api_search_plants():
        data = request.get_json()
        query = (data.get('query') or '').lower()
        filters = data.get('filters', {})
        sort = data.get('sort', 'relevance')
        page = int(data.get('page', 1))
        per_page = int(data.get('per_page', 12))

        try:
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            plants = []

        # Filter by search query
        if query:
            plants = [p for p in plants if
                      (query in p.get('common_name', '').lower()) or
                      (query in p.get('scientific_name', '').lower()) or
                      (query in p.get('medicinal_uses', '').lower())]

        # Filter by region
        region_filter = filters.get('region')
        if region_filter:
            plants = [p for p in plants if p.get('region') and any(region in p.get('region') for region in region_filter)]

        # Filter by habitat
        habitat_filter = filters.get('habitat')
        if habitat_filter:
            plants = [p for p in plants if p.get('habitat') and any(habitat in p.get('habitat') for habitat in habitat_filter)]

        # Filter by preparation method
        prep_filter = filters.get('preparation_method')
        if prep_filter:
            plants = [p for p in plants if p.get('preparation_method') and any(prep in p.get('preparation_method') for prep in prep_filter)]

        # Filter by parts used
        parts_used_filter = filters.get('parts_used')
        if parts_used_filter:
            plants = [p for p in plants if p.get('parts_used') and any(part in p.get('parts_used') for part in parts_used_filter)]

        # Filter by medicinal uses
        medicinal_uses_filter = filters.get('medicinal_uses')
        if medicinal_uses_filter:
            plants = [p for p in plants if p.get('medicinal_uses') and any(use.lower() in p.get('medicinal_uses').lower() for use in medicinal_uses_filter)]
        
        # Filter by image presence
        if filters.get('has_image'):
            plants = [p for p in plants if p.get('image_url')]

        # Safety filters - check precautions field
        if filters.get('safe_pregnancy'):
            plants = [p for p in plants if not any(word in p.get('precautions', '').lower() for word in ['pregnant', 'pregnancy', 'lactation', 'breast'])]

        if filters.get('no_interactions'):
            plants = [p for p in plants if 'interact' not in p.get('precautions', '').lower()]

        # Sorting
        if sort == 'name':
            plants.sort(key=lambda x: x['common_name'])
        elif sort == 'name-desc':
            plants.sort(key=lambda x: x['common_name'], reverse=True)
        elif sort == 'newest':
            plants.sort(key=lambda x: x.get('date_added', ''), reverse=True)
        elif sort == 'popular':
            plants.sort(key=lambda x: x.get('views', 0), reverse=True)

        total = len(plants)
        # Pagination
        start = (page - 1) * per_page
        end = start + per_page
        paged_results = plants[start:end]

        response = {
            'plants': paged_results,
            'total': total,
            'pagination': {
                'current_page': page,
                'per_page': per_page,
                'total_pages': (total + per_page - 1) // per_page,
                'has_prev': page > 1,
                'has_next': end < total
            },
            'did_you_mean': None  # Placeholder for 'did you mean' feature
        }
        return jsonify(response)


    @app.route('/api/search-suggestions', methods=['GET'])
    def api_search_suggestions():
        query = request.args.get('q', '').lower()
        if not query or len(query) < 2:
            return jsonify([])

        try:
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return jsonify([])

        suggestions = []
        seen = set()

        for p in plants:
            common_name = p.get('common_name', '')
            if query in common_name.lower():
                if common_name not in seen:
                    suggestions.append({'type': 'plant', 'value': common_name, 'id': p.get('id')})
                    seen.add(common_name)
            
            # Limit to 5 suggestions
            if len(suggestions) >= 5:
                break
                
        return jsonify(suggestions)

    @app.route('/api/compare-plants', methods=['POST'])
    def api_compare_plants():
        """Compare multiple plants side-by-side"""
        data = request.get_json()
        plant_ids = data.get('plant_ids', [])
        
        if not plant_ids or len(plant_ids) < 2:
            return jsonify({'error': 'Please select at least 2 plants to compare'}), 400
        
        try:
            with open('static/data/plants.json', 'r') as f:
                all_plants = json.load(f)
            
            # Filter to only requested plants and maintain order
            plants_ordered = []
            for plant_id in plant_ids:
                plant = next((p for p in all_plants if p.get('id') == plant_id), None)
                if plant:
                    plants_ordered.append(plant)
            
            if len(plants_ordered) == 0:
                return jsonify({'error': 'No matching plants found'}), 404
            
            return jsonify({
                'success': True,
                'plants': plants_ordered
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/plants-page')
    def plants_page():
        """Render dedicated Plants page (separate from JSON /plants API)."""
        plant_id = request.args.get('plant', None)
        
        # If a plant ID is requested, load and display that plant
        plant = None
        if plant_id:
            try:
                with open('static/data/plants.json', 'r', encoding='utf-8') as f:
                    plants_data = json.load(f)
                    plant = next((p for p in plants_data if p.get('id') == plant_id), None)
            except (FileNotFoundError, json.JSONDecodeError):
                pass
        
        return render_template('main/plants.html', 
                             template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates'),
                             plant=plant,
                             plant_id=plant_id)
    
    @app.route('/plants')
    def plants():
        try:
            with open(os.path.join(app.static_folder, 'data', 'plants.json'), 'r', encoding='utf-8') as f:
                plants = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Error loading plants: {e}")
            plants = []
        return jsonify(plants)

    @app.route('/plant/<string:plant_id>')
    def plant_details(plant_id):
        return redirect(url_for('plants_page', plant=plant_id))
    
    # Test route to check if static files are working
    @app.route('/test-css')
    def test_css():
        import os
        css_path = os.path.join(app.static_folder, 'css', 'styles.css')
        css_exists = os.path.exists(css_path)
        return f'CSS file exists: {css_exists}<br>CSS path: {css_path}<br>Static folder: {app.static_folder}'

    @app.route('/test-static')
    def test_static():
        css_path = os.path.join(app.static_folder, 'css', 'admin.css')
        css_exists = os.path.exists(css_path)
        return f'CSS file exists: {css_exists}<br>CSS path: {css_path}<br>Static folder: {app.static_folder}'

    @app.route('/test-plants-data')
    def test_plants_data():
        import os
        import json
        plants_file_path = os.path.join(app.static_folder, 'data', 'plants.json')
        
        if not os.path.exists(plants_file_path):
            return f'plants.json not found at: {plants_file_path}', 404
        
        try:
            with open(plants_file_path, 'r') as f:
                plants_data = json.load(f)
            return f'plants.json found and loaded successfully. Number of plants: {len(plants_data)}', 200
        except json.JSONDecodeError as e:
            return f'Error decoding plants.json: {e}', 500
        except Exception as e:
            return f'An unexpected error occurred: {e}', 500
    
    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if request.method == 'POST':
            username = request.form['username']
            password = request.form['password']
            
            print(f"DEBUG: Login attempt - Username: '{username}', Password length: {len(password)}")
            
            user = User.query.filter_by(username=username).first()
            print(f"DEBUG: User found: {user is not None}")
            
            if user:
                print(f"DEBUG: User details - ID: {user.id}, Username: '{user.username}', Is Admin: {user.is_admin}")
                stored_hash = user.password_hash
                provided_hash = hashlib.sha256(password.encode()).hexdigest()
                print(f"DEBUG: Stored hash: {stored_hash}")
                print(f"DEBUG: Provided hash: {provided_hash}")
                print(f"DEBUG: Hashes match: {stored_hash == provided_hash}")
                
                if user.password_hash == hashlib.sha256(password.encode()).hexdigest():
                    session['user_id'] = user.id
                    session['username'] = user.username
                    session['is_admin'] = user.is_admin
                    print(f"DEBUG: Login successful for user {user.username}")
                    log_action('login', user.username)
                    flash('Login successful!', 'success')
                    # Redirect to admin panel if user is admin
                    if user.is_admin:
                        return redirect(url_for('admin'))
                    return redirect(url_for('index'))
            
            print(f"DEBUG: Login failed for username: {username}")
            log_action('login_failed', username)
            flash('Invalid username or password', 'error')
        
        return render_template('admin/login.html')

    @app.route('/register', methods=['GET', 'POST'])
    def register():
        if request.method == 'POST':
            username = request.form['username']
            email = request.form['email']
            password = request.form['password']
            
            user = User.query.filter_by(username=username).first()
            if user:
                flash('Username already exists', 'error')
                return redirect(url_for('register'))
            
            user = User.query.filter_by(email=email).first()
            if user:
                flash('Email already exists', 'error')
                return redirect(url_for('register'))
            
            new_user = User(
                username=username,
                email=email,
                password_hash=hashlib.sha256(password.encode()).hexdigest()
            )
            db.session.add(new_user)
            db.session.commit()
            
            flash('Registration successful! Please log in.', 'success')
            return redirect(url_for('login'))
        
        return render_template('admin/register.html')
    
    @app.route('/logout')
    def logout():
        username = session.get('username')
        session.clear()
        if username:
            log_action('logout', username)
        flash('You have been logged out.', 'info')
        return redirect(url_for('index'))
    
    @app.route('/admin')
    @login_required
    def admin():
        if not session.get('is_admin'):
            flash('Access denied. Admin privileges required.')
            return redirect(url_for('index'))
        
        # Get current user data
        user = User.query.get(session['user_id'])
        current_user = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_admin': user.is_admin,
            'avatar': user.avatar or url_for('static', filename='images/default_plant.jpg')
        }
        
        # Load necessary data for admin dashboard
        stats = {
            'total_plants': 0,
            'active_users': User.query.count(),
            'page_views': 0,
            'new_comments': 0
        }
        
        # Load plants count
        try:
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
                stats['total_plants'] = len(plants)
        except (FileNotFoundError, json.JSONDecodeError):
            plants = []
        
        # Load users
        users = User.query.all()

        # Load notifications
        notifications = []  # Add your notification logic here
        
        # Load settings
        settings = load_settings()

        # Load logs
        logs = []
        if os.path.exists(LOG_FILE):
            try:
                with open(LOG_FILE, 'r', encoding='utf-8') as f:
                    logs = json.load(f)
            except Exception as e:
                print(f"Error loading logs: {e}")

        # Load visit and plant stats for charts
        visit_stats = {
            'labels': json.dumps(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
            'data': json.dumps([12, 19, 3, 5, 2, 3, 7])
        }
        
        plant_stats = {
            'labels': json.dumps(['Herbs', 'Shrubs', 'Trees', 'Other']),
            'data': json.dumps([4, 3, 2, 1])
        }

        return render_template('admin/admin.html', 
                            stats=stats, 
                            plants=plants, 
                            users=users,
                            current_user=current_user,
                            notifications=notifications,
                            settings=settings,
                            logs=logs,
                            visit_stats=visit_stats,
                            plant_stats=plant_stats,
                            section='dashboard')

    
    
    # API Routes
    @app.route('/api/plants')
    def api_plants():
        try:
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            plants = []
        return jsonify(plants)

    @app.route('/api/plants/<string:plant_id>')
    def api_plant(plant_id):
        try:
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
            plant = next((p for p in plants if p['id'] == plant_id), None)
            if plant:
                return jsonify(plant)
            return jsonify({'error': 'Plant not found'}), 404
        except (FileNotFoundError, json.JSONDecodeError):
            return jsonify({'error': 'Plants data not found'}), 404
    
    @app.route('/api/upload-image', methods=['POST'])
    @login_required
    def api_upload_image():
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400

        file = request.files['image']

        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        if file:
            filename = secure_filename(file.filename)
            upload_path = os.path.join(app.static_folder, 'images', 'uploads', filename)
            file.save(upload_path)
            file_url = url_for('static', filename=f'images/uploads/{filename}', _external=True)
            return jsonify({'file_url': file_url})

        return jsonify({'error': 'File upload failed'}), 500

    @app.route('/api/plants', methods=['POST'])
    @login_required
    def api_add_plant():
        try:
            plants = []
            if os.path.exists('static/data/plants.json'):
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)

            new_plant = {
                "id": request.form.get('id') or str(len(plants) + 1),
                "common_name": request.form['common_name'],
                "scientific_name": request.form['scientific_name'],
                "medicinal_uses": request.form.get('medicinal_uses', ''),
                "preparation_method": request.form.get('preparation_method', ''),
                "parts_used": request.form.get('parts_used', ''),
                "region": request.form.get('region', ''),
                "precautions": request.form.get('precautions', ''),
                "description": request.form.get('description', ''),
                "habitat": request.form.get('habitat', ''),
                "image_url": request.form.get('image_url', ''),
                "date_added": datetime.now().strftime('%Y-%m-%d')
            }
            plants.append(new_plant)

            with open('static/data/plants.json', 'w') as f:
                json.dump(plants, f, indent=2)

            log_action('add_plant', session.get('username'), {'plant_name': new_plant['common_name']})
            return jsonify(new_plant), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/plants/<string:plant_id>', methods=['PUT'])
    @login_required
    @csrf_required
    def api_update_plant(plant_id):
        try:
            plants = []
            if os.path.exists('static/data/plants.json'):
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)

            updated_plant_data = {
                "common_name": request.form.get('common_name'),
                "scientific_name": request.form.get('scientific_name'),
                "medicinal_uses": request.form.get('medicinal_uses', ''),
                "preparation_method": request.form.get('preparation_method', ''),
                "parts_used": request.form.get('parts_used', ''),
                "region": request.form.get('region', ''),
                "precautions": request.form.get('precautions', ''),
                "description": request.form.get('description', ''),
                "habitat": request.form.get('habitat', ''),
                "image_url": request.form.get('image_url', '')
            }

            # Handle file upload
            if 'image' in request.files:
                file = request.files['image']
                if file.filename != '':
                    filename = secure_filename(file.filename)
                    upload_path = os.path.join(app.static_folder, 'images', 'uploads', filename)
                    file.save(upload_path)
                    updated_plant_data['image_url'] = url_for('static', filename=f'images/uploads/{filename}', _external=True)


            found = False
            for i, plant in enumerate(plants):
                if plant['id'] == plant_id:
                    # Update only provided fields, keep existing if not provided
                    for key, value in updated_plant_data.items():
                        if value is not None:
                            plants[i][key] = value
                    found = True
                    break

            if not found:
                return jsonify({'error': 'Plant not found'}), 404

            with open('static/data/plants.json', 'w') as f:
                json.dump(plants, f, indent=2)

            log_action('update_plant', session.get('username'), {'plant_id': plant_id, 'updated_data': updated_plant_data.get('common_name', 'N/A')})
            return jsonify({'success': True, 'message': 'Plant updated successfully'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/plants/<string:plant_id>', methods=['DELETE'])
    @login_required
    @csrf_required
    def api_delete_plant(plant_id):
        try:
            plants = []
            if os.path.exists('static/data/plants.json'):
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)

            initial_len = len(plants)
            plants = [plant for plant in plants if plant['id'] != plant_id]

            if len(plants) == initial_len:
                return jsonify({'error': 'Plant not found'}), 404

            with open('static/data/plants.json', 'w') as f:
                json.dump(plants, f, indent=2)

            log_action('delete_plant', session.get('username'), {'plant_id': plant_id})
            return jsonify({'success': True, 'message': 'Plant deleted successfully'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/plants/bulk-delete', methods=['DELETE'])
    @login_required
    @csrf_required
    def api_bulk_delete_plants():
        try:
            data = request.get_json()
            ids_to_delete = data.get('ids', [])

            if not ids_to_delete:
                return jsonify({'error': 'No plant IDs provided'}), 400

            plants = []
            if os.path.exists('static/data/plants.json'):
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)

            initial_len = len(plants)
            plants = [plant for plant in plants if plant['id'] not in ids_to_delete]

            if len(plants) == initial_len:
                return jsonify({'error': 'No matching plants found for deletion'}), 404

            with open('static/data/plants.json', 'w') as f:
                json.dump(plants, f, indent=2)

            log_action('bulk_delete_plants', session.get('username'), {'deleted_ids': ids_to_delete})
            return jsonify({'success': True, 'message': f'{initial_len - len(plants)} plants deleted successfully'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # Search route
    @app.route('/api/search')
    def api_search():
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify([])
        
        try:
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            plants = []

        # Search in name, scientific name, and medicinal uses
        filtered_plants = [p for p in plants if 
                           (query.lower() in p.get('common_name', '').lower()) or 
                           (query.lower() in p.get('scientific_name', '').lower()) or 
                           (query.lower() in p.get('medicinal_uses', '').lower())]
        
        log_action('search', session.get('username'), {'query': query})
        return jsonify(filtered_plants)
    
    @app.route('/api/suggest')
    def api_suggest():
        query = request.args.get('q', '').strip().lower()
        if not query:
            return jsonify([])
        
        try:
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            plants = []

        # Collect all possible suggestion sources
        suggestions = set()
        
        # Search in common names, scientific names, and medicinal uses
        for plant in plants:
            # Add common name suggestions
            common_name = plant.get('common_name', '').lower()
            if query in common_name:
                suggestions.add(('common_name', plant['common_name']))
            
            # Add scientific name suggestions
            scientific_name = plant.get('scientific_name', '').lower()
            if query in scientific_name:
                suggestions.add(('scientific_name', plant['scientific_name']))
            
            # Add medicinal uses suggestions
            medicinal_uses = plant.get('medicinal_uses', '').lower()
            if query in medicinal_uses:
                # Split medicinal uses into individual phrases
                uses = [use.strip() for use in medicinal_uses.split(',')]
                for use in uses:
                    if query in use and len(use) >= len(query):
                        suggestions.add(('medicinal_use', use.strip().capitalize()))
            
            # Add region suggestions
            region = plant.get('region', '').lower()
            if query in region:
                suggestions.add(('region', plant['region']))
        
        # Convert suggestions to list and sort by relevance
        suggestion_list = sorted(list(suggestions), 
                               key=lambda x: (x[0] != 'common_name', # Common names first
                                           not x[1].lower().startswith(query), # Exact matches first
                                           len(x[1]))) # Shorter suggestions first
        
        # Format suggestions with type and value
        formatted_suggestions = [
            {
                'type': s[0],
                'value': s[1],
                'display': f"{s[1]} ({s[0].replace('_', ' ').title()})"
            } 
            for s in suggestion_list[:10]  # Limit to 10 suggestions
        ]
        
        return jsonify(formatted_suggestions)
    
    # Admin API Routes
    @app.route('/admin/api/users', methods=['GET'])
    @login_required
    def api_list_users():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403
        
        users = User.query.all()
        return jsonify([{
            'id': u.id,
            'username': u.username,
            'email': u.email,
            'is_admin': u.is_admin,
            'avatar': url_for('static', filename=f'images/{u.avatar}'), # Assuming avatar is stored in static/images
            'role': 'Admin' if u.is_admin else 'User',
            'status': 'Active' # Placeholder, you might want to add a real status to your User model
        } for u in users])
    
    @app.route('/admin/api/users', methods=['POST'])
    @login_required
    @csrf_required
    def api_add_user():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.json
        if not data or not data.get('username') or not data.get('email'):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Check if user already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        password = data.get('password', 'changeme')
        user = User(
            username=data['username'],
            email=data['email'],
            password_hash=hashlib.sha256(password.encode()).hexdigest(),
            is_admin=data.get('is_admin', False)
        )
        
        db.session.add(user)
        db.session.commit()
        
        log_action('add_user', session.get('username'), {'new_user': user.username})
        return jsonify({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_admin': user.is_admin
        }), 201
    
    @app.route('/admin/api/users/<int:user_id>', methods=['PUT'])
    @login_required
    @csrf_required
    def api_update_user(user_id):
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        user = User.query.get_or_404(user_id)
        data = request.json

        if 'username' in data:
            user.username = data['username']
        if 'email' in data:
            user.email = data['email']
        if 'is_admin' in data:
            user.is_admin = data['is_admin']
        if 'password' in data and data['password']:
            user.password_hash = hashlib.sha256(data['password'].encode()).hexdigest()

        db.session.commit()
        log_action('update_user', session.get('username'), {'updated_user': user.username})
        return jsonify({'success': True})

    @app.route('/admin/api/users/<int:user_id>', methods=['DELETE'])
    @login_required
    def api_delete_user(user_id):
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403
        
        user = User.query.get_or_404(user_id)
        if user.id == session.get('user_id'):
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        username = user.username
        db.session.delete(user)
        db.session.commit()
        
        log_action('delete_user', session.get('username'), {'deleted_user': username})
        return jsonify({'success': True})

    @app.route('/api/users/bulk-delete', methods=['DELETE'])
    @login_required
    @csrf_required
    def api_bulk_delete_users():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            data = request.get_json()
            ids_to_delete = data.get('ids', [])

            if not ids_to_delete:
                return jsonify({'error': 'No user IDs provided'}), 400

            # Prevent deleting the current user
            current_user_id = session.get('user_id')
            if str(current_user_id) in ids_to_delete:
                ids_to_delete.remove(str(current_user_id))

            num_deleted = User.query.filter(User.id.in_(ids_to_delete)).delete(synchronize_session=False)
            db.session.commit()

            if num_deleted == 0:
                return jsonify({'error': 'No matching users found for deletion'}), 404

            log_action('bulk_delete_users', session.get('username'), {'deleted_ids': ids_to_delete})
            return jsonify({'success': True, 'message': f'{num_deleted} users deleted successfully'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/admin/chart-data')
    @login_required
    def admin_chart_data():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403
            
        # Calculate monthly and yearly growth for plants and users
        monthly_growth = {
            'plants': {'current': 0, 'previous': 0},
            'users': {'current': 0, 'previous': 0}
        }
        yearly_growth = {
            'plants': {'current': 0, 'previous': 0},
            'users': {'current': 0, 'previous': 0}
        }

        try:
            # Get current date ranges
            now = datetime.now()
            current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            previous_month_start = (current_month_start - timedelta(days=1)).replace(day=1)
            current_year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            previous_year_start = current_year_start.replace(year=current_year_start.year - 1)

            # Calculate plant growth
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
                for plant in plants:
                    if 'date_added' in plant:
                        date_added = datetime.strptime(plant['date_added'], '%Y-%m-%d')
                        
                        # Monthly growth
                        if date_added >= current_month_start:
                            monthly_growth['plants']['current'] += 1
                        elif previous_month_start <= date_added < current_month_start:
                            monthly_growth['plants']['previous'] += 1

                        # Yearly growth
                        if date_added >= current_year_start:
                            yearly_growth['plants']['current'] += 1
                        elif previous_year_start <= date_added < current_year_start:
                            yearly_growth['plants']['previous'] += 1

            # Calculate user growth
            all_users = User.query.all()
            for user in all_users:
                # For this example, we'll use the ID to estimate creation time
                # In a real app, you'd have a creation_date field
                estimated_date = now - timedelta(days=user.id)
                
                # Monthly growth
                if estimated_date >= current_month_start:
                    monthly_growth['users']['current'] += 1
                elif previous_month_start <= estimated_date < current_month_start:
                    monthly_growth['users']['previous'] += 1

                # Yearly growth
                if estimated_date >= current_year_start:
                    yearly_growth['users']['current'] += 1
                elif previous_year_start <= estimated_date < current_year_start:
                    yearly_growth['users']['previous'] += 1

        except Exception as e:
            print(f"Error calculating growth comparisons: {e}")

        try:
            # Calculate weekly visits from logs
            weekly_visits = [0] * 7  # One entry for each day of the week
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    week_ago = datetime.now() - timedelta(days=7)
                    
                    for log in logs:
                        if log['action'] == 'login':
                            try:
                                log_date = datetime.fromisoformat(log['timestamp'])
                                if log_date >= week_ago:
                                    # Get day index (0 = Monday, 6 = Sunday)
                                    day_index = log_date.weekday()
                                    weekly_visits[day_index] += 1
                            except ValueError:
                                continue
            except Exception as e:
                print(f"Error processing logs for weekly visits: {e}")

            # Calculate plant categories distribution and trends
            plant_categories = {
                'Herbs': 0,
                'Trees': 0,
                'Shrubs': 0,
                'Climbers': 0,
                'Others': 0
            }

            # For tracking trends, we'll group plants by month
            monthly_trends = {}
            
            try:
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)
                    for plant in plants:
                        # Determine category
                        category = 'Others'
                        description = plant.get('description', '').lower()
                        
                        if any(word in description for word in ['herb', 'herbal', 'herbaceous']):
                            category = 'Herbs'
                        elif any(word in description for word in ['tree', 'tall']):
                            category = 'Trees'
                        elif any(word in description for word in ['shrub', 'bush']):
                            category = 'Shrubs'
                        elif any(word in description for word in ['climber', 'vine', 'creeper']):
                            category = 'Climbers'
                        
                        plant_categories[category] += 1

                        # Add to monthly trends if date is available
                        if 'date_added' in plant:
                            try:
                                date_added = datetime.strptime(plant['date_added'], '%Y-%m-%d')
                                month_key = date_added.strftime('%Y-%m')
                                
                                if month_key not in monthly_trends:
                                    monthly_trends[month_key] = {
                                        'Herbs': 0,
                                        'Trees': 0,
                                        'Shrubs': 0,
                                        'Climbers': 0,
                                        'Others': 0
                                    }
                                monthly_trends[month_key][category] += 1
                            except ValueError:
                                continue
            except Exception as e:
                print(f"Error processing plant categories: {e}")

            # Convert monthly trends to sorted lists for the chart
            sorted_months = sorted(monthly_trends.keys())
            category_trends = {
                'labels': sorted_months,
                'datasets': {}
            }

            for category in plant_categories.keys():
                category_trends['datasets'][category] = [
                    monthly_trends[month][category] for month in sorted_months
                ]

            # Calculate medicinal uses statistics
            medicinal_uses = {}
            try:
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)
                    for plant in plants:
                        uses = plant.get('medicinal_uses', '').split(',')
                        for use in uses:
                            use = use.strip().lower()
                            if use:  # Skip empty strings
                                medicinal_uses[use] = medicinal_uses.get(use, 0) + 1
                
                # Sort by frequency and get top 10
                sorted_uses = sorted(medicinal_uses.items(), key=lambda x: x[1], reverse=True)
                top_uses = sorted_uses[:10]
                medicinal_uses_data = {
                    'labels': [use[0].title() for use in top_uses],
                    'values': [use[1] for use in top_uses]
                }
            except Exception as e:
                print(f"Error processing medicinal uses: {e}")
                medicinal_uses_data = {'labels': [], 'values': []}

            # Calculate region distribution
            region_distribution = {
                'Asia': 0,
                'Africa': 0,
                'Europe': 0,
                'North America': 0,
                'South America': 0,
                'Oceania': 0
            }

            try:
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)
                    for plant in plants:
                        region = plant.get('region', '').strip()
                        # Map common region names and variations
                        region_mapping = {
                            'asia': 'Asia',
                            'african': 'Africa',
                            'africa': 'Africa',
                            'europe': 'Europe',
                            'european': 'Europe',
                            'north america': 'North America',
                            'american': 'North America',
                            'south america': 'South America',
                            'oceania': 'Oceania',
                            'australia': 'Oceania',
                            'pacific': 'Oceania'
                        }
                        
                        region_lower = region.lower()
                        for key, value in region_mapping.items():
                            if key in region_lower:
                                region_distribution[value] += 1
                                break
                        
            except Exception as e:
                print(f"Error processing region distribution: {e}")

            return jsonify({
                'weeklyVisits': weekly_visits,
                'plantCategories': list(plant_categories.values()),
                'categoryTrends': category_trends,
                'medicinalUses': medicinal_uses_data,
                'regionDistribution': region_distribution
            })

        except Exception as e:
            print(f"Error generating chart data: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/admin/generate-report', methods=['POST'])
    @login_required
    def admin_generate_report():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            current_time = datetime.now()
            report_data = {
                'generated_at': current_time.isoformat(),
                'generated_by': session.get('username'),
                'system_stats': {},
                'user_stats': {},
                'plant_stats': {},
                'activity_stats': {}
            }

            # System Statistics
            total_logs = 0
            error_count = 0
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    total_logs = len(logs)
                    error_count = len([log for log in logs if 'error' in log['action'].lower()])
            except Exception as e:
                print(f"Error processing logs for report: {e}")

            report_data['system_stats'] = {
                'total_logs': total_logs,
                'error_rate': f"{(error_count/total_logs*100):.2f}%" if total_logs > 0 else "0%",
                'system_uptime': "N/A"  # Could be implemented with actual server uptime
            }

            # User Statistics
            total_users = User.query.count()
            admin_users = User.query.filter_by(is_admin=True).count()
            report_data['user_stats'] = {
                'total_users': total_users,
                'admin_users': admin_users,
                'regular_users': total_users - admin_users
            }

            # Plant Statistics
            try:
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)
                    
                # Get plants added in last 30 days
                thirty_days_ago = (current_time - timedelta(days=30)).strftime('%Y-%m-%d')
                recent_plants = [p for p in plants if p.get('date_added', '') >= thirty_days_ago]
                
                report_data['plant_stats'] = {
                    'total_plants': len(plants),
                    'plants_added_30d': len(recent_plants),
                    'plants_with_images': len([p for p in plants if p.get('image_url')])
                }
            except Exception as e:
                print(f"Error processing plants for report: {e}")
                report_data['plant_stats'] = {
                    'total_plants': 0,
                    'plants_added_30d': 0,
                    'plants_with_images': 0
                }

            # Activity Statistics
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    day_ago = (current_time - timedelta(days=1)).isoformat()
                    week_ago = (current_time - timedelta(days=7)).isoformat()
                    
                    report_data['activity_stats'] = {
                        'logins_24h': len([log for log in logs if log['action'] == 'login' and log['timestamp'] > day_ago]),
                        'searches_7d': len([log for log in logs if log['action'] == 'search' and log['timestamp'] > week_ago]),
                        'plants_modified_7d': len([log for log in logs if log['action'] in ['add_plant', 'update_plant', 'delete_plant'] and log['timestamp'] > week_ago])
                    }
            except Exception as e:
                print(f"Error processing activity stats for report: {e}")
                report_data['activity_stats'] = {
                    'logins_24h': 0,
                    'searches_7d': 0,
                    'plants_modified_7d': 0
                }

            # Save report
            reports_dir = os.path.join('static', 'reports')
            if not os.path.exists(reports_dir):
                os.makedirs(reports_dir)

            report_filename = f"admin_report_{current_time.strftime('%Y%m%d_%H%M%S')}.json"
            report_path = os.path.join(reports_dir, report_filename)
            
            with open(report_path, 'w') as f:
                json.dump(report_data, f, indent=2)

            # Log report generation
            log_action('generate_report', session.get('username'), {'filename': report_filename})

            return jsonify({
                'success': True,
                'message': 'Report generated successfully',
                'report_path': f'/static/reports/{report_filename}'
            })

        except Exception as e:
            print(f"Error generating report: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/admin/backup', methods=['POST'])
    @login_required
    def admin_create_backup():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            current_time = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_dir = os.path.join('static', 'backups', current_time)
            os.makedirs(backup_dir, exist_ok=True)

            # Backup configuration files
            config_backup_dir = os.path.join(backup_dir, 'config')
            os.makedirs(config_backup_dir, exist_ok=True)

            config_files = [
                ('config/users.json', 'users.json'),
                ('config/admin_settings.json', 'admin_settings.json'),
                ('config/logs.json', 'logs.json'),
                ('config/admin_config.json', 'admin_config.json')
            ]

            for src, dst in config_files:
                if os.path.exists(src):
                    with open(src, 'r') as f_src:
                        content = json.load(f_src)
                    with open(os.path.join(config_backup_dir, dst), 'w') as f_dst:
                        json.dump(content, f_dst, indent=2)

            # Backup plants data
            data_backup_dir = os.path.join(backup_dir, 'data')
            os.makedirs(data_backup_dir, exist_ok=True)

            if os.path.exists('static/data/plants.json'):
                with open('static/data/plants.json', 'r') as f_src:
                    plants = json.load(f_src)
                with open(os.path.join(data_backup_dir, 'plants.json'), 'w') as f_dst:
                    json.dump(plants, f_dst, indent=2)

            # Backup database
            import shutil
            db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'medicinal_plants.db')
            if os.path.exists(db_path):
                shutil.copy2(db_path, os.path.join(backup_dir, 'medicinal_plants.db'))

            # Create backup manifest
            manifest = {
                'backup_date': current_time,
                'created_by': session.get('username'),
                'files_included': {
                    'config_files': [dst for _, dst in config_files],
                    'data_files': ['plants.json'],
                    'database': 'medicinal_plants.db'
                }
            }

            with open(os.path.join(backup_dir, 'manifest.json'), 'w') as f:
                json.dump(manifest, f, indent=2)

            # Create zip archive
            import zipfile
            zip_path = os.path.join('static', 'backups', f'backup_{current_time}.zip')
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, _, files in os.walk(backup_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, backup_dir)
                        zipf.write(file_path, arcname)

            # Clean up temporary backup directory
            shutil.rmtree(backup_dir)

            # Log backup creation
            log_action('create_backup', session.get('username'), {'backup_file': f'backup_{current_time}.zip'})

            return jsonify({
                'success': True,
                'message': 'Backup created successfully',
                'backup_file': f'/static/backups/backup_{current_time}.zip'
            })

        except Exception as e:
            print(f"Error creating backup: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/admin/notifications')
    @login_required
    def get_admin_notifications():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            notifications = []
            current_time = datetime.now()

            # Check system health and add notifications
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    recent_logs = [log for log in logs if datetime.fromisoformat(log['timestamp']) > 
                                (current_time - timedelta(hours=24))]
                    error_logs = [log for log in recent_logs if 'error' in log['action'].lower()]
                    
                    if len(error_logs) > 5:
                        notifications.append({
                            'id': f'sys_health_{current_time.timestamp()}',
                            'title': '⚠️ System Health Alert',
                            'message': f'High error rate detected: {len(error_logs)} errors in the last 24 hours',
                            'timestamp': current_time.isoformat(),
                            'type': 'error',
                            'read': False
                        })
            except Exception as e:
                print(f"Error checking system health: {e}")

            # Check for inactive users
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    active_users = set(log['user'] for log in logs 
                                    if datetime.fromisoformat(log['timestamp']) > 
                                    (current_time - timedelta(days=7)))
                    all_users = set(user.username for user in User.query.all())
                    inactive_users = all_users - active_users
                    
                    if inactive_users:
                        notifications.append({
                            'id': f'inactive_users_{current_time.timestamp()}',
                            'title': '👥 Inactive Users',
                            'message': f'{len(inactive_users)} users have not logged in for 7 days',
                            'timestamp': current_time.isoformat(),
                            'type': 'warning',
                            'read': False
                        })
            except Exception as e:
                print(f"Error checking inactive users: {e}")

            # Check for unmoderated plants
            try:
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)
                    unmoderated = [p for p in plants if not p.get('moderated', False)]
                    if unmoderated:
                        notifications.append({
                            'id': f'unmod_plants_{current_time.timestamp()}',
                            'title': '🌱 Plants Pending Review',
                            'message': f'{len(unmoderated)} plants need moderation',
                            'timestamp': current_time.isoformat(),
                            'type': 'info',
                            'read': False
                        })
            except Exception as e:
                print(f"Error checking unmoderated plants: {e}")

            # Check backup status
            backup_dir = os.path.join('static', 'backups')
            if os.path.exists(backup_dir):
                backup_files = [f for f in os.listdir(backup_dir) if f.endswith('.zip')]
                if not backup_files:
                    notifications.append({
                        'id': f'no_backup_{current_time.timestamp()}',
                        'title': '💾 Backup Reminder',
                        'message': 'No backup found. Consider creating a backup of your data.',
                        'timestamp': current_time.isoformat(),
                        'type': 'warning',
                        'read': False
                    })
                else:
                    latest_backup = max(backup_files, key=lambda x: os.path.getctime(os.path.join(backup_dir, x)))
                    backup_time = datetime.fromtimestamp(os.path.getctime(os.path.join(backup_dir, latest_backup)))
                    if (current_time - backup_time).days >= 7:
                        notifications.append({
                            'id': f'old_backup_{current_time.timestamp()}',
                            'title': '💾 Backup Needed',
                            'message': f'Last backup is {(current_time - backup_time).days} days old',
                            'timestamp': current_time.isoformat(),
                            'type': 'warning',
                            'read': False
                        })

            # Sort notifications by timestamp (newest first)
            notifications.sort(key=lambda x: x['timestamp'], reverse=True)

            return jsonify({'notifications': notifications})

        except Exception as e:
            print(f"Error fetching notifications: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/admin/notifications/<notification_id>/read', methods=['POST'])
    @login_required
    def mark_notification_read(notification_id):
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403
            
        # In a real application, you would update the notification status in a database
        return jsonify({'success': True})

    @app.route('/api/admin/export/<data_type>')
    @login_required
    def export_data(data_type):
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        format_type = request.args.get('format', 'json')
        if format_type not in ['json', 'csv']:
            return jsonify({'error': 'Invalid format'}), 400

        try:
            if data_type == 'plants':
                # Export plants data
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)
                
                if format_type == 'json':
                    return jsonify(plants)
                else:
                    si = io.StringIO()
                    writer = csv.DictWriter(si, fieldnames=[
                        'id', 'common_name', 'scientific_name', 'medicinal_uses',
                        'preparation_method', 'parts_used', 'region', 'precautions',
                        'description', 'habitat', 'image_url', 'date_added'
                    ])
                    writer.writeheader()
                    writer.writerows(plants)
                    output = make_response(si.getvalue())
                    output.headers['Content-Type'] = 'text/csv'
                    output.headers['Content-Disposition'] = 'attachment; filename=medicinal_plants.csv'
                    return output

            elif data_type == 'users':
                # Export users data (excluding sensitive information)
                users = User.query.all()
                user_data = [{
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'is_admin': user.is_admin,
                    'avatar': user.avatar
                } for user in users]

                if format_type == 'json':
                    return jsonify(user_data)
                else:
                    si = io.StringIO()
                    writer = csv.DictWriter(si, fieldnames=['id', 'username', 'email', 'is_admin', 'avatar'])
                    writer.writeheader()
                    writer.writerows(user_data)
                    output = make_response(si.getvalue())
                    output.headers['Content-Type'] = 'text/csv'
                    output.headers['Content-Disposition'] = 'attachment; filename=users.csv'
                    return output

            elif data_type == 'logs':
                # Export system logs
                if os.path.exists(LOG_FILE):
                    with open(LOG_FILE, 'r') as f:
                        logs = json.load(f)

                    if format_type == 'json':
                        return jsonify(logs)
                    else:
                        si = io.StringIO()
                        writer = csv.DictWriter(si, fieldnames=['timestamp', 'action', 'user', 'details'])
                        writer.writeheader()
                        writer.writerows(logs)
                        output = make_response(si.getvalue())
                        output.headers['Content-Type'] = 'text/csv'
                        output.headers['Content-Disposition'] = 'attachment; filename=system_logs.csv'
                        return output
                else:
                    return jsonify([])

            else:
                return jsonify({'error': 'Invalid data type'}), 400

        except Exception as e:
            print(f"Error exporting {data_type}: {e}")
            return jsonify({'error': 'Export failed'}), 500

    @app.route('/api/admin/plants/<string:plant_id>/moderate', methods=['POST'])
    @login_required
    def moderate_plant(plant_id):
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            data = request.get_json()
            approved = data.get('approved', False)

            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)

            # Find the plant and update its moderation status
            plant_found = False
            for plant in plants:
                if plant['id'] == plant_id:
                    plant['moderated'] = approved
                    plant['moderated_by'] = session.get('username')
                    plant['moderated_at'] = datetime.now().isoformat()
                    plant_found = True
                    break

            if not plant_found:
                return jsonify({'error': 'Plant not found'}), 404

            # Save the updated plants data
            with open('static/data/plants.json', 'w') as f:
                json.dump(plants, f, indent=2)

            # Log the moderation action
            action = 'approve_plant' if approved else 'revoke_plant_approval'
            log_action(action, session.get('username'), {
                'plant_id': plant_id,
                'plant_name': next((p['common_name'] for p in plants if p['id'] == plant_id), None)
            })

            return jsonify({'success': True, 'message': 'Plant moderation status updated'})

        except Exception as e:
            print(f"Error moderating plant: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/admin/system-health')
    @login_required
    def system_health():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            # Calculate error rate
            error_rate = 0
            error_rate_change = 0
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    
                    # Get logs from last hour and previous hour
                    now = datetime.now()
                    hour_ago = now - timedelta(hours=1)
                    two_hours_ago = now - timedelta(hours=2)
                    
                    current_hour_logs = [
                        log for log in logs
                        if datetime.fromisoformat(log['timestamp']) > hour_ago
                    ]
                    previous_hour_logs = [
                        log for log in logs
                        if two_hours_ago < datetime.fromisoformat(log['timestamp']) <= hour_ago
                    ]
                    
                    if current_hour_logs:
                        current_errors = len([log for log in current_hour_logs if 'error' in log['action'].lower()])
                        error_rate = (current_errors / len(current_hour_logs)) * 100
                    
                    if previous_hour_logs:
                        previous_errors = len([log for log in previous_hour_logs if 'error' in log['action'].lower()])
                        previous_error_rate = (previous_errors / len(previous_hour_logs)) * 100
                        error_rate_change = error_rate - previous_error_rate
            except Exception as e:
                print(f"Error calculating error rate: {e}")

            # Calculate response time (simulated)
            response_time = 150  # Simulated 150ms response time
            response_time_change = -5  # Simulated 5% improvement

            # Calculate database size
            db_size = 0
            db_size_change = 0
            try:
                db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance', 'medicinal_plants.db')
                if os.path.exists(db_path):
                    current_size = os.path.getsize(db_path)
                    db_size = current_size
                    
                    # Compare with size from 24 hours ago (if we had historical data)
                    # For now, simulate a small change
                    db_size_change = 2.5  # Simulated 2.5% growth
            except Exception as e:
                print(f"Error calculating database size: {e}")

            return jsonify({
                'error_rate': round(error_rate, 2),
                'error_rate_change': round(error_rate_change, 2),
                'response_time': response_time,
                'response_time_change': response_time_change,
                'db_size': db_size,
                'db_size_change': db_size_change
            })

        except Exception as e:
            print(f"Error getting system health: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/admin/error-logs')
    @login_required
    def get_error_logs():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            error_logs = []
            if os.path.exists(LOG_FILE):
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    
                    # Get errors from the last 24 hours
                    day_ago = datetime.now() - timedelta(days=1)
                    error_logs = [
                        {
                            'id': str(i),
                            'timestamp': log['timestamp'],
                            'message': log['action'],
                            'details': str(log.get('details', {})),
                            'acknowledged': log.get('acknowledged', False)
                        }
                        for i, log in enumerate(logs)
                        if 'error' in log['action'].lower() and
                        datetime.fromisoformat(log['timestamp']) > day_ago and
                        not log.get('acknowledged', False)
                    ]

            return jsonify({'errors': error_logs})

        except Exception as e:
            print(f"Error getting error logs: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/admin/error-logs/clear', methods=['POST'])
    @login_required
    def clear_error_logs():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            if os.path.exists(LOG_FILE):
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                
                # Keep non-error logs
                filtered_logs = [log for log in logs if 'error' not in log['action'].lower()]
                
                with open(LOG_FILE, 'w') as f:
                    json.dump(filtered_logs, f, indent=2)

            return jsonify({'success': True})

        except Exception as e:
            print(f"Error clearing error logs: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/admin/optimize-db', methods=['POST'])
    @login_required
    def optimize_database():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            # Vacuum the SQLite database
            db.session.execute('VACUUM')
            db.session.commit()

            return jsonify({'success': True})

        except Exception as e:
            print(f"Error optimizing database: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/admin/system-test', methods=['POST'])
    @login_required
    def run_system_test():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            results = []

            # Test database connection
            try:
                db.session.execute('SELECT 1')
                results.append('✓ Database connection: OK')
            except Exception as e:
                results.append(f'❌ Database connection: Failed - {str(e)}')

            # Test file system access
            try:
                test_file = os.path.join('static', 'test.tmp')
                with open(test_file, 'w') as f:
                    f.write('test')
                os.remove(test_file)
                results.append('✓ File system access: OK')
            except Exception as e:
                results.append(f'❌ File system access: Failed - {str(e)}')

            # Test configuration files
            config_files = ['users.json', 'admin_settings.json', 'logs.json']
            for file in config_files:
                path = os.path.join('config', file)
                if os.path.exists(path):
                    try:
                        with open(path, 'r') as f:
                            json.load(f)
                        results.append(f'✓ Config file {file}: OK')
                    except Exception as e:
                        results.append(f'❌ Config file {file}: Failed - {str(e)}')
                else:
                    results.append(f'❌ Config file {file}: Missing')

            return jsonify({
                'success': True,
                'results': results
            })

        except Exception as e:
            print(f"Error running system test: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/admin/error-logs/<error_id>/acknowledge', methods=['POST'])
    @login_required
    def acknowledge_error(error_id):
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            if os.path.exists(LOG_FILE):
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                
                # Mark the error as acknowledged
                for log in logs:
                    if 'error' in log['action'].lower():
                        log['acknowledged'] = True
                
                with open(LOG_FILE, 'w') as f:
                    json.dump(logs, f, indent=2)

            return jsonify({'success': True})

        except Exception as e:
            print(f"Error acknowledging error: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/admin/user-analytics')
    @login_required
    def user_analytics():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            now = datetime.now()
            
            # Get hourly activity data
            hourly_activity = [0] * 24
            hourly_labels = []
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    day_ago = now - timedelta(days=1)
                    
                    # Create hour labels
                    for i in range(24):
                        hour = (now - timedelta(hours=24-i)).strftime('%H:00')
                        hourly_labels.append(hour)
                    
                    # Count activities per hour
                    for log in logs:
                        log_time = datetime.fromisoformat(log['timestamp'])
                        if log_time > day_ago:
                            hour_index = 23 - (now - log_time).seconds // 3600
                            if 0 <= hour_index < 24:
                                hourly_activity[hour_index] += 1
            except Exception as e:
                print(f"Error processing hourly activity: {e}")

            # Get popular searches
            popular_searches = []
            search_terms = Counter()
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    week_ago = now - timedelta(days=7)
                    
                    for log in logs:
                        if (log['action'] == 'search' and 
                            datetime.fromisoformat(log['timestamp']) > week_ago and
                            'details' in log and 'query' in log['details']):
                            search_terms[log['details']['query']] += 1
                    
                    popular_searches = [
                        {'term': term, 'count': count}
                        for term, count in search_terms.most_common(10)
                    ]
            except Exception as e:
                print(f"Error processing search terms: {e}")

            # Get recent activity
            recent_activity = []
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    recent_logs = sorted(
                        [log for log in logs if log['user']],
                        key=lambda x: x['timestamp'],
                        reverse=True
                    )[:10]
                    
                    for log in recent_logs:
                        activity = {
                            'timestamp': log['timestamp'],
                            'action': log['action'],
                            'details': str(log.get('details', ''))
                        }
                        recent_activity.append(activity)
            except Exception as e:
                print(f"Error processing recent activity: {e}")

            # Get active users
            active_users = []
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    day_ago = now - timedelta(days=1)
                    
                    user_activity = Counter(
                        log['user'] for log in logs
                        if datetime.fromisoformat(log['timestamp']) > day_ago and log['user']
                    )
                    
                    for username, count in user_activity.most_common(5):
                        user = User.query.filter_by(username=username).first()
                        if user:
                            active_users.append({
                                'username': user.username,
                                'avatar': user.avatar or 'default_avatar.png',
                                'activity': f'{count} actions today'
                            })
            except Exception as e:
                print(f"Error processing active users: {e}")

            # Get recent users
            recent_users = []
            try:
                newest_users = User.query.order_by(User.id.desc()).limit(5).all()
                for user in newest_users:
                    recent_users.append({
                        'username': user.username,
                        'avatar': user.avatar or 'default_avatar.png',
                        'activity': 'New user'
                    })
            except Exception as e:
                print(f"Error processing recent users: {e}")

            # Get search analytics
            search_analytics = []
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    week_ago = now - timedelta(days=7)
                    
                    searches = Counter()
                    for log in logs:
                        if (log['action'] == 'search' and 
                            datetime.fromisoformat(log['timestamp']) > week_ago and
                            'details' in log and 'query' in log['details']):
                            searches[log['details']['query']] += 1
                    
                    search_analytics = [
                        {'term': term, 'count': count}
                        for term, count in searches.most_common(5)
                    ]
            except Exception as e:
                print(f"Error processing search analytics: {e}")

            # Calculate engagement metrics
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    now = datetime.now()
                    day_ago = now - timedelta(days=1)
                    
                    # Calculate active sessions and session duration
                    sessions = {}
                    active_sessions = 0
                    total_duration = timedelta()
                    session_count = 0
                    
                    for log in logs:
                        if log['action'] in ['login', 'logout'] and 'user' in log:
                            user = log['user']
                            log_time = datetime.fromisoformat(log['timestamp'])
                            
                            if log['action'] == 'login':
                                sessions[user] = {'start': log_time}
                                if log_time > day_ago:
                                    active_sessions += 1
                            elif log['action'] == 'logout' and user in sessions:
                                if 'start' in sessions[user]:
                                    duration = log_time - sessions[user]['start']
                                    total_duration += duration
                                    session_count += 1
                                    del sessions[user]

                    # Calculate average session duration in minutes
                    avg_session_duration = (total_duration.total_seconds() / session_count / 60) if session_count > 0 else 0
                    
                    # Calculate page views
                    page_views = len([log for log in logs if 
                                    datetime.fromisoformat(log['timestamp']) > day_ago and
                                    log['action'] not in ['login', 'logout']])
                    
                    # Calculate activity heatmap
                    heatmap_data = [[0 for _ in range(24)] for _ in range(7)]  # 7 days x 24 hours
                    week_ago = now - timedelta(days=7)
                    
                    for log in logs:
                        log_time = datetime.fromisoformat(log['timestamp'])
                        if log_time > week_ago:
                            day_index = log_time.weekday()
                            hour_index = log_time.hour
                            heatmap_data[day_index][hour_index] += 1
            except Exception as e:
                print(f"Error calculating engagement metrics: {e}")
                active_sessions = 0
                avg_session_duration = 0
                page_views = 0
                heatmap_data = [[0 for _ in range(24)] for _ in range(7)]

            return jsonify({
                'hourly_labels': hourly_labels,
                'hourly_activity': hourly_activity,
                'popular_searches': popular_searches,
                'recent_activity': recent_activity,
                'active_users': active_users,
                'recent_users': recent_users,
                'search_analytics': search_analytics,
                'engagement_metrics': {
                    'active_sessions': active_sessions,
                    'avg_session_duration': round(avg_session_duration, 1),
                    'page_views': page_views,
                    'activity_heatmap': heatmap_data
                }
            })

        except Exception as e:
            print(f"Error getting user analytics: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/admin/api/settings', methods=['GET'])
    @login_required
    def api_get_settings():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403
        return jsonify(load_settings())
    
    @app.route('/admin/api/settings', methods=['POST'])
    @login_required
    @csrf_required
    def api_update_settings():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        settings = load_settings()
        settings['site_title'] = data.get('site_title', settings['site_title'])
        settings['theme'] = data.get('theme', settings['theme'])
        settings['notifications_enabled'] = data.get('notifications_enabled', settings['notifications_enabled'])
        save_settings(settings)
        
        log_action('update_settings', session.get('username'))
        return jsonify(settings)

    # Image Management Routes
    @app.route('/admin/images')
    @login_required
    def admin_images():
        if not session.get('is_admin'):
            flash('Access denied. Admin privileges required.')
            return redirect(url_for('index'))

        # Get all images from the uploads directory
        uploads_dir = os.path.join(app.static_folder, 'images', 'uploads')
        if not os.path.exists(uploads_dir):
            os.makedirs(uploads_dir)

        # Get list of images and their details
        images = []
        for filename in os.listdir(uploads_dir):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                image_path = os.path.join('images', 'uploads', filename)
                image_url = url_for('static', filename=image_path)
                images.append({
                    'name': filename,
                    'url': image_url,
                    'date_added': datetime.fromtimestamp(os.path.getctime(os.path.join(uploads_dir, filename))).strftime('%Y-%m-%d')
                })

        # Get plants for the assign dropdown
        try:
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
        except:
            plants = []

        return render_template('admin/image_management.html', 
                            images=images, 
                            plants=plants,
                            section='images')

    @app.route('/admin/images/upload', methods=['POST'])
    @login_required
    def admin_upload_images():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        uploaded_files = request.files.getlist('images')
        if not uploaded_files:
            flash('No files selected', 'error')
            return redirect(url_for('admin_images'))

        uploads_dir = os.path.join(app.static_folder, 'images', 'uploads')
        if not os.path.exists(uploads_dir):
            os.makedirs(uploads_dir)

        success_count = 0
        for file in uploaded_files:
            if file and file.filename:
                filename = secure_filename(file.filename)
                try:
                    file.save(os.path.join(uploads_dir, filename))
                    success_count += 1
                except Exception as e:
                    flash(f'Error saving {filename}: {str(e)}', 'error')

        if success_count:
            flash(f'Successfully uploaded {success_count} images', 'success')
        return redirect(url_for('admin_images'))

    @app.route('/admin/images/<path:filename>', methods=['DELETE'])
    @login_required
    def admin_delete_image(filename):
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            # Verify the filename is secure
            filename = secure_filename(filename)
            file_path = os.path.join(app.static_folder, 'images', 'uploads', filename)
            
            if os.path.exists(file_path):
                # Check if image is being used by any plant
                try:
                    with open('static/data/plants.json', 'r') as f:
                        plants = json.load(f)
                        for plant in plants:
                            if filename in plant.get('image_url', ''):
                                return jsonify({
                                    'success': False, 
                                    'error': 'Image is currently assigned to a plant'
                                }), 400
                except:
                    pass  # If we can't check plants, proceed with deletion

                # Delete the file
                os.remove(file_path)
                return jsonify({'success': True})
            else:
                return jsonify({
                    'success': False,
                    'error': 'File not found'
                }), 404

        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

    @app.route('/admin/images/assign', methods=['POST'])
    @login_required
    def admin_assign_image():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            image_name = request.form.get('image_name')
            plant_id = request.form.get('plant_id')

            if not image_name or not plant_id:
                flash('Missing image name or plant ID', 'error')
                return redirect(url_for('admin_images'))

            # Load plants data
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)

            # Find and update the plant
            for plant in plants:
                if plant['id'] == plant_id:
                    # Update image URL
                    plant['image_url'] = url_for('static', 
                                               filename=f'images/uploads/{image_name}',
                                               _external=True)
                    break
            else:
                flash('Plant not found', 'error')
                return redirect(url_for('admin_images'))

            # Save updated plants data
            with open('static/data/plants.json', 'w') as f:
                json.dump(plants, f, indent=2)

            flash('Image successfully assigned to plant', 'success')
            return redirect(url_for('admin_images'))

        except Exception as e:
            flash(f'Error assigning image: {str(e)}', 'error')
            return redirect(url_for('admin_images'))

    @app.route('/admin/api/export-plants')
    @login_required
    def api_export_plants():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403
        
        try:
            with open('static/data/plants.json', 'r') as f:
                plants = json.load(f)
            
            # Create CSV content
            si = io.StringIO()
            cw = csv.writer(si)

            # Write headers
            headers = ["id", "common_name", "scientific_name", "medicinal_uses", "preparation_method", "parts_used", "region", "precautions", "description", "habitat", "image_url", "date_added"]
            cw.writerow(headers)

            # Write data rows
            for plant in plants:
                row = [plant.get(h, '') for h in headers]
                cw.writerow(row)
            
            output = make_response(si.getvalue())
            output.headers["Content-Disposition"] = "attachment; filename=medicinal_plants.csv"
            output.headers["Content-type"] = "text/csv"
            
            log_action('export_plants', session.get('username'))
            return output

        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    @app.route('/admin/api/plants-data', methods=['POST'])
    @login_required
    @csrf_required
    def api_update_plants_data():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403
        
        try:
            updated_data = request.json
            with open('static/data/plants.json', 'w') as f:
                json.dump(updated_data, f, indent=2)
            
            log_action('update_plants_data', session.get('username'))
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # Contact form route
    @app.route('/api/contact', methods=['POST'])
    def api_contact():
        data = request.json
        if not data or not data.get('name') or not data.get('email') or not data.get('message'):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Log the contact form submission
        log_action('contact_form', None, {
            'name': data['name'],
            'email': data['email'],
            'message': data['message'][:100]  # Log first 100 chars of message
        })
        
        # In a real application, you would send an email or save to database
        # For now, just return success
        return jsonify({'success': True, 'message': 'Thank you for your message!'})

    @app.route('/api/admin/dashboard-stats')
    @login_required
    def dashboard_stats():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403

        try:
            # Get total plants and calculate growth
            total_plants = 0
            plants_this_month = 0
            plants_last_month = 0
            
            try:
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)
                total_plants = len(plants)
                
                # Calculate plants growth
                today = datetime.now()
                this_month = today.replace(day=1)
                last_month = (this_month - timedelta(days=1)).replace(day=1)
                
                for plant in plants:
                    if 'date_added' in plant:
                        date_added = datetime.strptime(plant['date_added'], '%Y-%m-%d')
                        if date_added >= this_month:
                            plants_this_month += 1
                        elif date_added >= last_month:
                            plants_last_month += 1
            except Exception as e:
                print(f"Error processing plants data: {e}")
            
            # Calculate growth percentages
            plants_growth = 0
            if plants_last_month > 0:
                plants_growth = ((plants_this_month - plants_last_month) / plants_last_month) * 100
            elif plants_this_month > 0:
                plants_growth = 100

            # Get total users and calculate growth
            total_users = User.query.count()
            users_this_month = User.query.filter(
                User.id.isnot(None)  # Assuming creation date would be added later
            ).count()
            users_last_month = total_users - users_this_month
            
            users_growth = 0
            if users_last_month > 0:
                users_growth = ((users_this_month - users_last_month) / users_last_month) * 100
            elif users_this_month > 0:
                users_growth = 100

            # Calculate active users (users who logged in within last 24 hours)
            active_users = 0
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    yesterday = (datetime.now() - timedelta(days=1)).isoformat()
                    active_users = len(set(
                        log['user'] for log in logs
                        if log['action'] == 'login' and log['timestamp'] > yesterday
                    ))
            except Exception as e:
                print(f"Error processing logs for active users: {e}")

            # Get recent searches from logs
            recent_searches = 0
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    week_ago = (datetime.now() - timedelta(days=7)).isoformat()
                    recent_searches = len([
                        log for log in logs
                        if log['action'] == 'search' and log['timestamp'] > week_ago
                    ])
            except Exception as e:
                print(f"Error processing logs for recent searches: {e}")

            # Calculate system health (simple metric based on recent errors)
            system_health = 100
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    day_ago = (datetime.now() - timedelta(days=1)).isoformat()
                    recent_logs = [log for log in logs if log['timestamp'] > day_ago]
                    error_logs = [log for log in recent_logs if 'error' in log['action'].lower()]
                    if recent_logs:
                        error_percentage = (len(error_logs) / len(recent_logs)) * 100
                        system_health = max(0, 100 - error_percentage)
            except Exception as e:
                print(f"Error calculating system health: {e}")

            # Get platform usage statistics
            platform_desktop = 60  # Placeholder - implement actual tracking
            platform_mobile = 40   # Placeholder - implement actual tracking

            stats = {
                'totalPlants': total_plants,
                'totalUsers': total_users,
                'activeUsers': active_users,
                'systemHealth': round(system_health),
                'recentSearches': recent_searches,
                'plantsGrowth': round(plants_growth, 1),
                'usersGrowth': round(users_growth, 1),
                'platformUsage': {
                    'desktop': platform_desktop,
                    'mobile': platform_mobile
                }
            }
            return jsonify(stats)

        except Exception as e:
            print(f"Error generating dashboard stats: {e}")
            return jsonify({'error': 'Internal server error'}), 500
    
    @app.route('/admin/reset-credentials', methods=['GET', 'POST'])
    @login_required
    def reset_credentials():
        if not session.get('is_admin'):
            flash('Access denied. Admin privileges required.', 'error')
            return redirect(url_for('index'))

        message = None
        message_type = None

        if request.method == 'POST':
            current_password = request.form.get('current_password')
            new_username = request.form.get('new_username')
            new_password = request.form.get('new_password')
            confirm_password = request.form.get('confirm_password')
            csrf_token = request.form.get('csrf_token')

            # Basic CSRF check (more robust implementation needed for production)
            if not csrf_token or csrf_token != session.get('csrf_token'):
                flash('Invalid CSRF token.', 'error')
                return redirect(url_for('reset_credentials'))

            user = User.query.get(session['user_id'])

            if not user or user.password_hash != hashlib.sha256(current_password.encode()).hexdigest():
                message = 'Incorrect current password.'
                message_type = 'error'
            elif new_password != confirm_password:
                message = 'New password and confirmation do not match.'
                message_type = 'error'
            elif len(new_password) < 8:
                message = 'New password must be at least 8 characters long.'
                message_type = 'error'
            else:
                # Update username if provided and different
                if new_username and new_username != user.username:
                    if User.query.filter_by(username=new_username).first():
                        message = 'Username already exists.'
                        message_type = 'error'
                    else:
                        user.username = new_username
                        log_action('admin_username_change', session.get('username'), {'old_username': session.get('username'), 'new_username': new_username})
                        session['username'] = new_username # Update session username
                
                user.password_hash = hashlib.sha256(new_password.encode()).hexdigest()
                db.session.commit()
                log_action('admin_password_change', session.get('username'))
                
                message = 'Credentials updated successfully. Please log in again with your new credentials.'
                message_type = 'success'
                session.clear() # Log out after changing credentials
                return redirect(url_for('login'))

        # Generate a new CSRF token for the form
        session['csrf_token'] = secrets.token_urlsafe(32)
        return render_template('admin/reset_credentials.html', message=message, message_type=message_type, csrf_token=session['csrf_token'])
    
    @app.route('/admin/logs')
    @login_required
    def admin_logs():
        if not session.get('is_admin'):
            flash('Access denied. Admin privileges required.', 'error')
            return redirect(url_for('index'))
        
        logs = []
        if os.path.exists(LOG_FILE):
            try:
                with open(LOG_FILE, 'r', encoding='utf-8') as f:
                    logs = json.load(f)
            except Exception as e:
                print(f"Error loading logs: {e}")
                flash('Error loading logs.', 'error')
        
        return render_template('admin/logs.html', logs=logs)

    @app.route('/api/admin/growth-analytics')
    @login_required
    def admin_growth_analytics():
        if not session.get('is_admin'):
            return jsonify({'error': 'Access denied'}), 403
            
        try:
            # Calculate monthly and yearly growth for plants and users
            monthly_growth = {
                'plants': {'current': 0, 'previous': 0},
                'users': {'current': 0, 'previous': 0}
            }
            yearly_growth = {
                'plants': {'current': 0, 'previous': 0},
                'users': {'current': 0, 'previous': 0}
            }

            # Get current date ranges
            now = datetime.now()
            current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            previous_month_start = (current_month_start - timedelta(days=1)).replace(day=1)
            current_year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            previous_year_start = current_year_start.replace(year=current_year_start.year - 1)

            # Calculate plant growth
            try:
                with open('static/data/plants.json', 'r') as f:
                    plants = json.load(f)
                    for plant in plants:
                        if 'date_added' in plant:
                            date_added = datetime.strptime(plant['date_added'], '%Y-%m-%d')
                            
                            # Monthly growth
                            if date_added >= current_month_start:
                                monthly_growth['plants']['current'] += 1
                            elif previous_month_start <= date_added < current_month_start:
                                monthly_growth['plants']['previous'] += 1

                            # Yearly growth
                            if date_added >= current_year_start:
                                yearly_growth['plants']['current'] += 1
                            elif previous_year_start <= date_added < current_year_start:
                                yearly_growth['plants']['previous'] += 1
            except Exception as e:
                print(f"Error calculating plant growth: {e}")

            # Calculate user growth (using estimation based on user IDs)
            try:
                all_users = User.query.all()
                for user in all_users:
                    # For this example, we'll use the ID to estimate creation time
                    # In a real app, you'd have a creation_date field
                    estimated_date = now - timedelta(days=user.id)
                    
                    # Monthly growth
                    if estimated_date >= current_month_start:
                        monthly_growth['users']['current'] += 1
                    elif previous_month_start <= estimated_date < current_month_start:
                        monthly_growth['users']['previous'] += 1

                    # Yearly growth
                    if estimated_date >= current_year_start:
                        yearly_growth['users']['current'] += 1
                    elif previous_year_start <= estimated_date < current_year_start:
                        yearly_growth['users']['previous'] += 1
            except Exception as e:
                print(f"Error calculating user growth: {e}")

            return jsonify({
                'comparativeGrowth': {
                    'monthly': monthly_growth,
                    'yearly': yearly_growth
                }
            })

        except Exception as e:
            print(f"Error generating growth analytics: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    # --- Autocomplete API Endpoint ---
    from flask import jsonify

    # Example: Replace PLANTS_DATA with your real database/data source
    PLANTS_DATA = [
        {'common_name': 'Aloe Vera'},
        {'common_name': 'Turmeric'},
        {'common_name': 'Ginger'},
        {'common_name': 'Holy Basil'},
        {'common_name': 'Neem'},
        {'common_name': 'Ashwagandha'},
        {'common_name': 'Bacopa Monnieri'},
        {'common_name': 'Amla'},
        {'common_name': 'Peppermint'},
        {'common_name': 'Tulsi'},
        # ... add real data here ...
    ]

    @app.route('/api/autocomplete')
    def autocomplete():
        query = request.args.get('q', '').lower()
        results = [p['common_name'] for p in PLANTS_DATA if query in p['common_name'].lower()][:10]
        return jsonify({'suggestions': results})

    @app.route('/api/export-plants', methods=['POST'])
    def export_plants():
        data = request.get_json()
        query = (data.get('query') or '').lower()
        filters = data.get('filters', {})
        sort = data.get('sort', 'relevance')
        
        # Filter and sort as in search above
        results = [p for p in PLANTS_DATA if query in p['common_name'].lower()]
        if sort == 'name':
            results.sort(key=lambda x: x['common_name'])
        elif sort == 'name-desc':
            results.sort(key=lambda x: x['common_name'], reverse=True)
        # Collect visible columns for export
        fieldnames = ['common_name']  # Extend with real fields
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for row in results:
            writer.writerow({f: row.get(f, '') for f in fieldnames})
        output.seek(0)
        return send_file(io.BytesIO(output.read().encode()), download_name='plants_export.csv', as_attachment=True, mimetype='text/csv')

    return app

# Create the Flask application
app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)