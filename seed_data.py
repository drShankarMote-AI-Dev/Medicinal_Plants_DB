import json
import os
import random
import hashlib
from datetime import datetime, timedelta
from app import create_app, db, User, LOG_FILE

app = create_app()

def seed_users():
    print("Seeding users...")
    with app.app_context():
        # Create admin user if not exists
        if not User.query.filter_by(username='admin').first():
            admin = User(
                username='admin',
                email='admin@example.com',
                password_hash=hashlib.sha256('admin123'.encode()).hexdigest(),
                is_admin=True,
                avatar='/static/images/default_avatar.png'
            )
            db.session.add(admin)
            print("Created admin user.")

        # Create regular users
        usernames = ['alice', 'bob', 'charlie', 'diana', 'eve']
        for name in usernames:
            if not User.query.filter_by(username=name).first():
                user = User(
                    username=name,
                    email=f'{name}@example.com',
                    password_hash=hashlib.sha256('password'.encode()).hexdigest(),
                    is_admin=False,
                    avatar='/static/images/default_avatar.png'
                )
                db.session.add(user)
                print(f"Created user: {name}")
        
        db.session.commit()

def seed_plants():
    print("Seeding plants data...")
    plants_file = 'static/data/plants.json'
    if not os.path.exists(plants_file):
        print("Plants file not found!")
        return

    with open(plants_file, 'r') as f:
        plants = json.load(f)

    updated = False
    start_date = datetime.now() - timedelta(days=730) # 2 years ago
    
    for plant in plants:
        if 'date_added' not in plant:
            # Random date within last 2 years
            random_days = random.randint(0, 730)
            date_added = start_date + timedelta(days=random_days)
            plant['date_added'] = date_added.strftime('%Y-%m-%d')
            updated = True
            
            # Add some random view counts if not present (optional, for future use)
            if 'views' not in plant:
                plant['views'] = random.randint(10, 500)

    if updated:
        with open(plants_file, 'w') as f:
            json.dump(plants, f, indent=2)
        print("Updated plants with date_added fields.")
    else:
        print("Plants already have date_added fields.")

def seed_logs():
    print("Seeding logs...")
    logs = []
    
    # Ensure config directory exists
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

    # Get users
    with app.app_context():
        users = [u.username for u in User.query.all()]
    
    if not users:
        users = ['admin', 'alice', 'bob']

    actions = ['login', 'search', 'view_plant', 'add_plant', 'update_plant', 'delete_plant', 'error']
    search_queries = ['headache', 'stomach', 'fever', 'cold', 'skin', 'sleep', 'anxiety', 'energy']
    
    # Generate logs for the last 30 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    current_date = start_date
    while current_date <= end_date:
        # Daily activity varies
        num_logs = random.randint(5, 20)
        
        for _ in range(num_logs):
            # Random time in the day
            log_time = current_date + timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
            
            action = random.choices(actions, weights=[30, 40, 20, 2, 3, 1, 4])[0]
            user = random.choice(users)
            
            log_entry = {
                'timestamp': log_time.isoformat(),
                'action': action,
                'user': user,
                'details': {}
            }
            
            if action == 'search':
                log_entry['details'] = {'query': random.choice(search_queries)}
            elif action == 'view_plant':
                log_entry['details'] = {'plant_id': f'plant_{random.randint(1, 100)}'}
            elif action == 'error':
                log_entry['details'] = {'error': 'Simulated error for testing'}
            
            logs.append(log_entry)
        
        current_date += timedelta(days=1)

    # Sort logs by timestamp
    logs.sort(key=lambda x: x['timestamp'])

    with open(LOG_FILE, 'w') as f:
        json.dump(logs, f, indent=2)
    print(f"Generated {len(logs)} log entries.")

if __name__ == '__main__':
    seed_users()
    seed_plants()
    seed_logs()
    print("Seeding complete!")
