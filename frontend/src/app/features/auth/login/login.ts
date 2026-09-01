import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email = '';
  password = '';
  mostrarPassword = signal(false);
  cargando = signal(false);
  error = signal<string | null>(null);

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  alternarMostrarPassword(): void {
    this.mostrarPassword.update((v) => !v);
  }

  async enviar(): Promise<void> {
    await this.autenticar((usuario) => (usuario.rol === 'SUSCRIPTOR' ? '/mi-cuenta' : '/panel'));
  }

  /**
   * Atajo de check-in: usa las mismas credenciales del formulario, pero en
   * vez de ir al dashboard entra directo a /panel/checkin. Si quien inicia
   * sesión no es ENTRENADOR, el guard de rol lo manda a su propia vista de
   * todos modos — el login sigue siendo válido, solo no aplica el atajo.
   */
  async entrarYChequear(): Promise<void> {
    await this.autenticar(() => '/panel/checkin');
  }

  private async autenticar(elegirDestino: (usuario: { rol: string }) => string): Promise<void> {
    this.error.set(null);
    this.cargando.set(true);
    try {
      const usuario = await this.auth.login(this.email, this.password);
      this.router.navigateByUrl(elegirDestino(usuario));
    } catch (err) {
      const mensaje =
        err instanceof HttpErrorResponse && err.error?.error
          ? err.error.error
          : 'No se pudo iniciar sesión. Intenta de nuevo.';
      this.error.set(mensaje);
    } finally {
      this.cargando.set(false);
    }
  }
}
