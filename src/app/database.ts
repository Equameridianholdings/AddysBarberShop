import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Database {
  
private http = inject(HttpClient);
  
  // Replace this with your Web App URL from the 'Deploy' button in Apps Script
  private scriptUrl = 'https://script.google.com/macros/s/AKfycbwwWEibMu9whb_RZsGZ1JFC56EeQS8Y3BymI8wDmm3OXLugJVBTjcyS5qstd7aE54fU/exec';
  /**
   * Fetches the full queue.
   * We will filter this in the component to show only unserved customers.
   */
  getQueue(): Observable<any[]> {
    return this.http.get<any>(this.scriptUrl).pipe(
      map((response: { status: string; data: any; }) => response.status === 'ok' ? response.data : [])
    );
  }

  /**
   * Fetches the Price list from the 'Prices' sheet
   */
  getPrices(): Observable<any[]> {
    return this.http.get<any>(`${this.scriptUrl}?sheet=Prices`).pipe(
      map(response => response.status === 'ok' ? response.data : [])
    );
  }
  getBarbers(): Observable<any[]> {
  return this.http.get<any>(`${this.scriptUrl}?sheet=Barbers`).pipe(
    map(response => response.status === 'ok' ? response.data : [])
  );
}

  /**
   * Sends the checkout data (totalAmount, paymentType, selectedProducts)
   */
  updateClient(payload: any): Observable<any> {
    // We stringify the payload to ensure Google Apps Script parses it correctly
    return this.http.post(this.scriptUrl, JSON.stringify(payload));
  }
}
