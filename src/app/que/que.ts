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
  priceList: any[] = [];
  barbers: any[] = [];
  
  // UI State Management
  showJoinModal = false;
  loading = false;
  
  // New Client Form Data
  newClient = { 
    name: '', 
    cellphoneNumber: '+27', 
    barber: '' 
  };

  // Checkout Selection Logic
  selectedCustomer: any = null; // When this is not null, show the "PAY" modal
  selectedProducts: any[] = [];

  ngOnInit() {
    this.loadData();
    this.fetchBarbers();
  }

  /**
   * REFRESH QUEUE & PRICES
   */
  loadData() {
    this.loading = true;
    this.db.getQueue().subscribe((data) => {
      // Filter: Only show customers where "Time out" is empty
      this.unservedCustomers = data.filter(c => !c['Time out'] || c['Time out'].trim() === '');
      this.loading = false;
    });

    this.db.getPrices().subscribe((prices) => {
      this.priceList = prices;
    });
  }

  fetchBarbers() {
    this.db.getBarbers().subscribe((data) => {
      this.barbers = data;
    });
  }

 // Add these to your class properties
isSubmitting = false;
// Ensure these properties exist at the top of your class
toaster = { show: false, message: '', success: true };

showToaster(msg: string, isSuccess: boolean) {
  console.log('Toaster Triggered:', msg); // Debugging line
  this.toaster = { 
    show: true, 
    message: msg, 
    success: isSuccess 
  };

  // Hide it after 3 seconds
  setTimeout(() => {
    this.toaster.show = false;
  }, 10000);
}

submitToQueue() {
  const phoneRegex = /^\+27\d{9}$/;
  
  if (!this.newClient.name || !this.newClient.barber) {
    this.showToaster('Please enter a name and select a barber.', false);
    return;
  }

  if (!phoneRegex.test(this.newClient.cellphoneNumber)) {
    this.showToaster('Invalid Phone! Must be +27 followed by 9 digits.', false);
    return;
  }

  // Start Loading State
  this.isSubmitting = true;

  const payload = {
    action: 'append',
    cellphoneNumber: this.newClient.cellphoneNumber,
    name: this.newClient.name,
    barber: this.newClient.barber
  };

  this.db.updateClient(payload).subscribe({
    next: (response: any) => {
      if (response && response.status === 'ok') {
        this.showToaster('Success! Added to the queue.', true);
        // Refresh after a short delay so user sees the success message
        setTimeout(() => window.location.reload(), 1500);
      } else {
        this.isSubmitting = false;
        this.showToaster(response.message || 'Try again.', false);
      }
    },
    error: (err) => {
      this.isSubmitting = false;
      this.showToaster('Connection failed. Please try again.', false);
    }
  });
}

// Helper to manage toaster timing

  resetJoinForm() {
    this.newClient = { name: '', cellphoneNumber: '+27', barber: '' };
  }

  /**
   * CHECKOUT / PAYMENT LOGIC
   */
  openCheckout(customer: any) {
    this.selectedCustomer = customer;
    this.selectedProducts = []; // Reset shopping cart
  }

  toggleProduct(product: any) {
    const index = this.selectedProducts.findIndex(p => p.CutType === product.CutType);
    if (index > -1) {
      this.selectedProducts.splice(index, 1);
    } else if (this.selectedProducts.length < 5) {
      this.selectedProducts.push(product);
    }
  }

  getTotal(): number {
    return this.selectedProducts.reduce((sum, p) => sum + Number(p.Price || 0), 0);
  }

  processPayment(method: 'Cash' | 'Card') {
    if (!this.selectedCustomer || this.selectedProducts.length === 0) {
      alert('Please select at least one service.');
      return;
    }

    const payload = {
      action: 'update',
      row: this.selectedCustomer._row,
      totalAmount: this.getTotal(),
      paymentType: method,
      selectedProducts: this.selectedProducts.map(p => p.CutType)
    };

    this.db.updateClient(payload).subscribe({
      next: () => {
        this.selectedCustomer = null; // Close checkout modal
        this.loadData(); // Refresh list to remove the served customer
      },
      error: (err) => alert('Error processing payment: ' + err)
    });
  }

  // Add these to your class properties
showSkipModal = false;
customerToSkip: any = null;

// Open the confirmation window
confirmSkip(customer: any) {
  this.customerToSkip = customer;
  this.showSkipModal = true;
}

// Perform the actual removal
executeSkip() {
  if (!this.customerToSkip) return;

  this.isSubmitting = true;

  const payload = {
    action: 'skip',
    row: this.customerToSkip._row
  };

  this.db.updateClient(payload).subscribe({
    next: (res: any) => {
      if (res && res.status === 'ok') {
        // 1. Show Success Toaster
        this.showToaster('Customer removed from queue', true);
        
        // 2. Close the modal
        this.showSkipModal = false;
        
        // 3. Refresh page after a short delay so they see the toaster
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        this.isSubmitting = false;
        this.showToaster(res.message || 'Error removing customer', false);
      }
    },
    error: (err) => {
      this.isSubmitting = false;
      this.showToaster('Connection error. Try again.', false);
      console.error('Skip error:', err);
    }
  });
}
  
}