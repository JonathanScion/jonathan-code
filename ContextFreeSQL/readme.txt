#create it
 py -m venv venv\

 #activate
 venv\Scripts\activate

#install whatever
pip install -r requirements.txt
#from work: pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt

 #deactivate
 deactivate

 #https://realpython.com/python-virtual-environments-a-primer/

 creation of db on RDS: make sure its 'publically available' while creating. then go to 'Security Groups' (create a new one, use existing one, either way) and make sure 'inbound rules' a;;pws for IPv4 0.0.0.0/0 and IPv6 ::/0

 run command:
 PS C:\Users\yonis\source\repos\veteran-developer\ContextFreeSQL> python -m src.main