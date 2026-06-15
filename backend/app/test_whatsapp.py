import pywhatkit as pwk

# Define your WhatsApp Group ID (Do not include the full URL, just the code)
group_id = "L1oV4kXabcDEfGhiJklMno"  # Replace with your actual Group ID

# Define your message
message = "Hello team! This is an automated message sent using Python."

try:
    # Method 1: Send the message instantly
    pwk.sendwhatmsg_to_group_instantly(group_id=group_id, message=message)
    print("Message processing initiated successfully!")
    
    # Method 2 (Optional): Schedule the message for a specific time (e.g., 15:30)
    # pwk.sendwhatmsg_to_group(group_id, message, time_hour=15, time_min=30)

except Exception as e:
    print(f"An error occurred: {e}")
