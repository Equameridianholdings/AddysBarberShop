import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError, timeout } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Database {
  
private http = inject(HttpClient);
  
  // Replace this with your Web App URL from the 'Deploy' button in Apps Script
  private scriptUrl = 'https://script.google.com/macros/s/AKfycbzuvOFWSoSV6bzMM3XNZw2-sMasFQL82WyF1RW9-DvbLdiFrz7ATfKOepFV-iqegm5y/exec';
  /**
   * Fetches the full queue.
   * We will filter this in the component to show only unserved customers.
   */
getQueue(sheet: string): Observable<any[]> {
  // Use Date.now() to force a fresh fetch every time
  const cb = Date.now();
  return this.http.get<any>(`${this.scriptUrl}?sheet=${sheet}&cb=${cb}`).pipe(
    timeout(15000),
    map((response: { status: string; data: any; }) => 
      response.status === 'ok' ? response.data : []
    ),
    catchError(error => {
      console.error('Queue fetch error:', error);
      return throwError(() => error);
    })
  );
}
// src/app/database.ts

getAssisted(): Observable<any[]> {
  const params = new HttpParams().set('sheet', 'Assisted');

  return this.http.get<any>(this.scriptUrl, { params }).pipe(
    map((response: { status: string; data: any; }) => 
      response.status === 'ok' ? response.data : []
    )
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
