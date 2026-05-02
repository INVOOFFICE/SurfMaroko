import os
from tkinter import Tk, Button, Label, filedialog, messagebox
from PIL import Image

def select_folder():
    folder = filedialog.askdirectory()
    if folder:
        label.config(text=folder)
        convert_images(folder)

def convert_images(folder):
    count = 0
    for filename in os.listdir(folder):
        if filename.lower().endswith(".jpg"):
            jpg_path = os.path.join(folder, filename)
            png_name = os.path.splitext(filename)[0] + ".png"
            png_path = os.path.join(folder, png_name)

            try:
                with Image.open(jpg_path) as img:
                    img.convert("RGB").save(png_path, "PNG")
                    count += 1
            except Exception as e:
                print(f"Erreur: {e}")

    messagebox.showinfo("Terminé", f"{count} images converties en PNG ✅")

# Interface
app = Tk()
app.title("Convertisseur JPG → PNG")
app.geometry("400x200")

label = Label(app, text="Choisir un dossier", wraplength=350)
label.pack(pady=20)

btn = Button(app, text="Sélectionner dossier", command=select_folder)
btn.pack(pady=10)

app.mainloop()