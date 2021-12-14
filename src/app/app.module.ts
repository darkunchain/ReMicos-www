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


@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    FooterComponent,
    CarouselComponent,
    GmapsComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NgxUsefulSwiperModule,
    AgmCoreModule.forRoot({
      apiKey: 'AIzaSyAHLkpXA6NJ-zobslk6rmyQ53JeoR8jQBQ'
    })

  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
