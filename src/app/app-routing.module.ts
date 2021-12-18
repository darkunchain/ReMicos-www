import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HorariosComponent } from './components/horarios/horarios.component';
import { CarouselComponent } from './components/carousel/carousel.component';
import { PageHomeComponent } from './components/page-home/page-home.component';
import { PageHorariosComponent } from './components/page-horarios/page-horarios.component';
import { PageAboutComponent } from './components/page-about/page-about.component';



const routes: Routes = [
  { path: 'home', component: PageHomeComponent },
  { path: '', component: PageHomeComponent },
  { path: 'horarios', component: PageHorariosComponent },
  { path: 'about', component: PageAboutComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
