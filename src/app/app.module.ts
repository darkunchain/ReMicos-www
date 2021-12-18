import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { CarouselComponent } from './components/carousel/carousel.component';
import { NgxUsefulSwiperModule } from 'ngx-useful-swiper';
import { AgmCoreModule } from '@agm/core';
import { GmapsComponent } from './components/gmaps/gmaps.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {MatIconModule} from '@angular/material/icon';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { HorariosComponent } from './components/horarios/horarios.component';
import { PageHomeComponent } from './components/page-home/page-home.component';
import { PageHorariosComponent } from './components/page-horarios/page-horarios.component';
import { PageAboutComponent } from './components/page-about/page-about.component';


@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    CarouselComponent,
    GmapsComponent,
    HorariosComponent,
    PageHomeComponent,
    PageHorariosComponent,
    PageAboutComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NgxUsefulSwiperModule,
    AgmCoreModule.forRoot({
      apiKey: 'AIzaSyAHLkpXA6NJ-zobslk6rmyQ53JeoR8jQBQ'
    }),
    BrowserAnimationsModule,
    MatIconModule,
    FontAwesomeModule

  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
