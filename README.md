# Otelsalaro — სასტუმროს სალარო

ეს პროექტი იყენებს:

- GitHub Pages frontend: `index.html`, `style.css`, `script.js`
- Google Sheets backend
- Google Apps Script API: `code.gs`

## 1. Apps Script

Google Sheet-ში გახსენი Extensions → Apps Script და ჩასვი `code.gs`.

შემდეგ გაუშვი ფუნქცია:

```js
setupDatabase
```

ეს შექმნის საჭირო Sheet-ებს:

- `Settings_SalesChannels`
- `Settings_PaymentMethods`
- `Settings_Rooms`
- `Shifts`
- `Transactions`
- `Expenses`
- `CashWithdrawals`
- `ShiftClose`
- `ShiftCloseDetails`
- `Adjustments`
- `EditLog`

## 2. Deploy

Apps Script-ში:

Deploy → New deployment → Web app

რეკომენდებული პარამეტრები:

- Execute as: Me
- Who has access: Anyone

მიღებული Web App URL ჩასმულია `script.js`-ში.

## 3. Frontend

GitHub Pages-ზე უნდა ჩართო:

Settings → Pages → Deploy from branch → main / root

შემდეგ გაიხსნება სალაროს ვებ აპი.

## 4. მუშაობის პრინციპი

აპი არ აკეთებს Sheet-თან მუდმივ მოთხოვნებს ყოველ წამს. მონაცემები იტვირთება გახსნისას და განახლების ღილაკით. ახალი ჩანაწერი იგზავნება მხოლოდ დადასტურების ღილაკზე.

## 5. მთავარი მოდულები

- ცვლის გახსნა
- ოთახის შემოსავალი
- სხვა შემოსავალი
- ხარჯები
- ინკასაცია
- ცვლის დახურვა
- რეგისტრაცია: გაყიდვების არხები, ბანკები, ნომრები
- სტატისტიკა
- ისტორია
