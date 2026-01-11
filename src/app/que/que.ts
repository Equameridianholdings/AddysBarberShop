import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Database } from '../database';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-que',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './que.html',
  styleUrl: './que.css',
})
export class Que implements OnInit {
  private db = inject(Database);

  // Data lists
  unservedCustomers: any[] = [];
  allCustomers: any[] = [];
  allAssistedData: any[] = []; 
  phoneSearchResults: any[] = [];
  priceList: any[] = [];
  barbers: any[] = [];
  
  // UI State Management
  showJoinModal = false;
  isSubmitting = false;
  isUserSelected = false; 
  isExistingUser = false; 
  currentTime = new Date();
  toaster = { show: false, message: '', success: true };

  // New Client Form Data
  newClient = { 
    name: '', 
    cellphoneNumber: '+27', 
    barber: '' 
  };

  // Checkout Selection Logic
  selectedCustomer: any = null;
  selectedProducts: any[] = [];
  showCashModal = false;
  showDigitalModal = false;
  cashReceived = 0;

  // Skip Logic
  showSkipModal = false;
  customerToSkip: any = null;

  ngOnInit() {
    this.loadData();
    this.fetchPrices();
    this.fetchBarbers();
    this.loadAssistedHistory(); 

    setInterval(() => {
      this.currentTime = new Date();
    }, 60000);
  }

  loadAssistedHistory() {
    this.db.getAssisted().subscribe({
      next: (data) => {
        this.allAssistedData = data;
        console.log('Search history loaded:', this.allAssistedData.length);
      },
      error: (err) => console.error('History failed to load', err)
    });
  }

  onPhoneInput() {
    const typedPhone = this.newClient.cellphoneNumber.trim();
    
    const existingUser = this.allAssistedData.find(u => {
      let sheetCell = u['Cellphone Number']?.toString() || '';
      if (sheetCell && !sheetCell.startsWith('+')) {
        sheetCell = '+' + sheetCell;
      }
      return sheetCell === typedPhone;
    });

    if (existingUser) {
      this.newClient.name = existingUser['Name'];
      this.newClient.barber = existingUser['Barber'];
      this.isExistingUser = true; 
      this.isUserSelected = true;
    } else {
      this.isExistingUser = false;
      this.isUserSelected = typedPhone.length >= 12; 
    }
  }

  // Color-coded Wait Time Logic
  getWaitTimeData(timeInStr: string) {
    if (!timeInStr) return { text: '0m', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' };
    
    const [hours, minutes] = timeInStr.split(':').map(Number);
    const checkIn = new Date();
    checkIn.setHours(hours, minutes, 0);

    if (checkIn > this.currentTime) {
      checkIn.setDate(checkIn.getDate() - 1);
    }

    const diffMs = this.currentTime.getTime() - checkIn.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    const timeText = diffMins < 60 ? `${diffMins}m` : `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
    
    if (diffMins < 30) {
      return { text: timeText, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' };
    } else if (diffMins < 60) {
      return { text: timeText, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    } else {
      return { text: timeText, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    }
  }

  loadData() {
    this.db.getQueue('Queue').subscribe({
      next: (data: any[]) => {
        this.allCustomers = data; 
        this.unservedCustomers = data.filter(c => !c['Time Out'] || c['Time Out'].trim() === '');
      },
      error: (err) => this.showToaster('Failed to load queue', false)
    });
  }

  fetchPrices() {
    this.db.getPrices().subscribe({
      next: (data) => this.priceList = data,
      error: (err) => this.showToaster('Failed to load services', false)
    });
  }

  fetchBarbers() {
    this.db.getBarbers().subscribe(data => this.barbers = data);
  }

  submitToQueue() {
    const phoneRegex = /^\+27\d{9}$/;
    if (!this.newClient.name || !this.newClient.barber) {
      this.showToaster('Please enter a name and select a barber.', false);
      return;
    }
    if (!phoneRegex.test(this.newClient.cellphoneNumber)) {
      this.showToaster('Invalid Phone! Use +27 followed by 9 digits.', false);
      return;
    }

    this.isSubmitting = true;
    const payload = {
      action: 'append',
      cellphoneNumber: this.newClient.cellphoneNumber,
      name: this.newClient.name,
      barber: this.newClient.barber
    };

    this.db.updateClient(payload).subscribe({
      next: (res: any) => {
        if (res.status === 'ok') {
          this.showToaster('Success! Added to the queue.', true);
          setTimeout(() => window.location.reload(), 500);
        } else {
          this.isSubmitting = false;
          this.showToaster(res.message || 'Try again.', false);
        }
      },
      error: () => {
        this.isSubmitting = false;
        this.showToaster('Connection failed.', false);
      }
    });
  }

  confirmSkip(customer: any) {
    this.customerToSkip = customer;
    this.showSkipModal = true;
  }

  executeSkip() {
    if (!this.customerToSkip) return;
    this.isSubmitting = true;
    this.db.updateClient({ action: 'skip', row: this.customerToSkip._row }).subscribe({
      next: () => {
        this.showToaster('Customer removed', true);
        this.showSkipModal = false;
        setTimeout(() => window.location.reload(), 1000);
      },
      error: () => { 
        this.isSubmitting = false; 
        this.showToaster('Error skipping', false); 
      }
    });
  }

  getAvgServiceTime(): string {
    const served = this.allCustomers.filter(c => c['Time In'] && c['Time Out'] && c['Time Out'].trim() !== '');
    if (served.length === 0) return '0m';
    const totalDiff = served.reduce((acc, c) => {
      const parseTime = (str: string) => {
        const [h, m] = str.split(':').map(Number);
        const d = new Date(); d.setHours(h, m, 0);
        return d.getTime();
      };
      const diff = (parseTime(c['Time Out']) - parseTime(c['Time In'])) / 60000;
      return acc + (diff > 0 ? diff : 0);
    }, 0);
    const avg = Math.round(totalDiff / served.length);
    return avg < 60 ? `${avg}m` : `${Math.floor(avg / 60)}h ${avg % 60}m`;
  }

  openCheckout(customer: any) {
    this.selectedCustomer = customer;
    this.selectedProducts = [];
    this.cashReceived = 0;
  }

  toggleProduct(product: any) {
    const index = this.selectedProducts.findIndex(p => p.CutType === product.CutType);
    if (index > -1) this.selectedProducts.splice(index, 1);
    else if (this.selectedProducts.length < 5) this.selectedProducts.push(product);
  }

  getTotal(): number {
    return this.selectedProducts.reduce((sum, p) => sum + Number(p.Price || 0), 0);
  }

  get changeDue(): number {
    return Math.max(0, this.cashReceived - this.getTotal());
  }

  processPayment(method: 'Cash' | 'Card') {
    if (method === 'Cash') this.showCashModal = true;
    else this.showDigitalModal = true;
  }

  confirmFinalPayment(method: string) {
    this.isSubmitting = true;
    const payload = {
      action: 'update',
      row: this.selectedCustomer._row,
      totalAmount: this.getTotal(),
      paymentType: method,
      selectedProducts: this.selectedProducts.map(p => p.CutType)
    };
    this.db.updateClient(payload).subscribe({
      next: () => {
        this.showToaster(`Payment Recorded: ${method}`, true);
        this.showCashModal = false;
        this.showDigitalModal = false;
        setTimeout(() => window.location.reload(), 500);
      },
      error: () => { 
        this.isSubmitting = false; 
        this.showToaster('Payment failed', false); 
      }
    });
  }

  showToaster(msg: string, isSuccess: boolean) {
    this.toaster = { show: true, message: msg, success: isSuccess };
    setTimeout(() => this.toaster.show = false, 5000);
  }

  closeModal() {
    this.showJoinModal = false;
    this.newClient = { name: '', cellphoneNumber: '+27', barber: '' };
    this.isUserSelected = false;
    this.isExistingUser = false;
  }
}